// Original code: https://github.com/pulumi/examples/blob/master/aws-ts-lambda-efs/index.ts
// Original blog: https://www.pulumi.com/blog/aws-lambda-efs/

// To test this project:
// 
// 	curl -X POST -d 'Hello world' $(pulumi stack output url)files/file.txt
// 	curl -X GET $(pulumi stack output url)files/file.txt

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const awsx = require('@pulumi/awsx')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const MNT_FOLDER = '/mnt/storage'

const main = async () => {

	// VPC
	const vpc = new awsx.ec2.Vpc(PROJECT, { subnets: [{ type: 'private' }, { type: 'public' }] })
	const subnetIds = await vpc.publicSubnetIds

	// EFS
	const filesystem = new aws.efs.FileSystem(PROJECT, {
		tags: {
			Name: PROJECT // That's also going to be used to add afriendly name to the resource.
		}
	})
	const targets = []
	for (let i = 0; i < subnetIds.length; i++) {
		targets.push(new aws.efs.MountTarget(`fs-mount-${i}`, {
			fileSystemId: filesystem.id,
			subnetId: subnetIds[i],
			securityGroups: [vpc.vpc.defaultSecurityGroupId],
		}))
	}
	const ap = new aws.efs.AccessPoint(PROJECT, {
		fileSystemId: filesystem.id,
		posixUser: { uid: 1000, gid: 1000 },
		rootDirectory: { 
			path: '/www', // The access points only work on sub-folder. Do not use '/'.
			creationInfo: { 
				ownerGid: 1000, 
				ownerUid: 1000, 
				permissions: '755' // 7 means the read+write+exec rights. 1st nbr is User, 2nd is Group and 3rd is Other.
			} 
		},
		tags: {
			Name: PROJECT // That's also going to be used to add afriendly name to the resource.
		}
	}, { dependsOn: targets })

	// IAM: Lambda role that allow lambda execution
	const lambdaRole = new aws.iam.Role(PROJECT, {
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'lambda.amazonaws.com',
				},
				Effect: 'Allow',
				Sid: ''
			}],
		}
	})
	// IAM: Allow lambda to create log groups, log streams and log events.
	const cloudWatchPolicy = new aws.iam.Policy(PROJECT, {
		path: '/',
		description: 'IAM policy for logging from a lambda',
		policy: JSON.stringify({
			Version: '2012-10-17',
			Statement: [{
				Action: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents'
				],
				Resource: 'arn:aws:logs:*:*:*',
				Effect: 'Allow'
			}]
		})
	})
	// IAM: Attach the cloudWatchPolicy to the lambda role.
	const lambdaLogs = new aws.iam.RolePolicyAttachment(`${PROJECT}-logs`, {
		role: lambdaRole.name,
		policyArn: cloudWatchPolicy.arn
	})
	
	// As described in the doc, the execution role for the lambda function must provide access 
	// to the VPC and EFS. The following AWS managed policies do just that, but might be too much
	// for production. To restrict access further, please refer to this document: 
	// https://docs.aws.amazon.com/efs/latest/ug/iam-access-control-nfs-efs.html
	const lambdaVpcAccess = new aws.iam.RolePolicyAttachment(`${PROJECT}-vpc-access`, {
		role: lambdaRole.name,
		policyArn: aws.iam.ManagedPolicy.AWSLambdaVPCAccessExecutionRole
	})
	const lambdaFullAccess = new aws.iam.RolePolicyAttachment(`${PROJECT}-lambda-fullaccess`, {
		role: lambdaRole.name,
		policyArn: aws.iam.ManagedPolicy.LambdaFullAccess
	})

	// ECR images. Doc:
	// 	- buildAndPushImage API: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ecr/#buildAndPushImage
	// 	- 2nd argument is a DockerBuild object: https://www.pulumi.com/docs/reference/pkg/docker/image/#dockerbuild
	const lambdaImage = awsx.ecr.buildAndPushImage(PROJECT, {
		context: './app'
	})

	// LAMBDA
	const lambda = new aws.lambda.Function(`${PROJECT}-docker`, {
		packageType: 'Image',
		imageUri: lambdaImage.imageValue,
		role: lambdaRole.arn,
		timeout: 300, // Unit seconds. Default is 3 and max is 900 (15 minutes).
		memorySize: 256, // Unit is MB. Default is 128 and max is 10,240
		vpcConfig: {
			subnetIds: vpc.privateSubnetIds,
			securityGroupIds: [vpc.vpc.defaultSecurityGroupId],
		},
		fileSystemConfig: { 
			arn: ap.arn, 
			localMountPath: MNT_FOLDER 
		},
		dependsOn:[
			lambdaLogs,
			lambdaVpcAccess,
			lambdaFullAccess
		]

	})

	// API Gateway with 3 routes and 3 lambdas
	const api = new awsx.apigateway.API('api', {
		routes: [
			{
				method: 'GET', 
				path: '/files', 
				eventHandler: lambda
			}
		],
	})

	// Exports
	return {
		url: api.url
	}
}

const output = main()

exports.url = output.then(o => o.url)
