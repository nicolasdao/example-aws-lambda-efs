# EXAMLE - USING PULUMI TO PROVISION AN AWS LAMBDA WITH CONTAINER + AWS EFS

This project assumes that:
- The AWS CLI is installed and a valid AWS account has been setup as the default profile (tip: use `npx switch-profile` to check this out).
- The Pulumi CLI is installed and you're currently logged in.
- If you wish to test this project locally, Docker is installed and is running.

```
npm i
npm run deploy
```

To test locally:

```
cd app
docker build -t app .
docker run -p 127.0.0.1:4000:8080 app:latest
```

To query the lambda:

```
curl -XPOST "http://localhost:4000/2015-03-31/functions/function/invocations" -d '{}'
```

# About this sample project

> The only stack is called __`dev`__ stack. It targets the `ap-southeast-2` region (Australia Sydney).

The `index.js` contains the Pulumi logic to provision:
- __VPC__ with both public and private subnets.
- __EFS__ file system in that VPC with an __Access Point__ to the `www` folder.
- __Docker image__ build and published to _AWS ECR_. That image is described in the `./app` folder.
- __Lambda__ using the _Docker image_ and configured to mount the _EFS Access Point_ on the `/mnt/storage` folder.
- __API Gateway__ that can request the _Lambda_.

The `app` folder contains an image with __Git__ installed. The `app/index.js` run a dummy program that returns the git version to confirm the Lambda can use Git via the `child_process` utility.

