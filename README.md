# Basic DynamoDB Lambda API

**A step-by-step guide to set up a CRUD RESTful API, using AWS CLI, DynamoDB and Lambda**

- Version: 0.0.1
- Created: 25th April 2025 by Rich Plastow
- Updated: 25th April 2025 by Rich Plastow
- Repo: <https://github.com/richplastow/basic-dynamodb-lambda-api>
- Demo: <https://richplastow.com/basic-dynamodb-lambda-api/>

---

## Overview

This step-by-step guide explains how to set up a Lambda function that provides
a [RESTful API](https://en.wikipedia.org/wiki/REST) for a DynamoDB table. The
API will allow signed-in users to perform CRUD (Create, Read, Update, Delete)
operations on the DynamoDB table.

A [Cognito User Pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html)
of admins and regular users will be created. And Cognito, alongside the usual
IAM roles and policies, will ensure that only authorized users can access the
DynamoDB table.

The Lambda function will run Node 18.x, and interact with DynamoDB using the
AWS SDK for JavaScript (v3). It will be triggered by HTTP requests, which will
usually contain a [JWT,](https://jwt.io/) sent to an API Gateway endpoint.

CloudWatch will monitor the Lambda function, and log any errors that occur.

## Prerequisites

- An AWS account
- Node.js installed locally, ideally using [nvm](https://github.com/nvm-sh/nvm)
- Basic knowledge of Node.js, AWS Lambda and DynamoDB
- A Mac running macOS 12.0 or later (though the steps should be similar for
  older macOS versions, and on Windows or Linux)
- This guide avoids the browser-based AWS Console, and uses the AWS CLI (Command
  Line Interface) instead, so you'll need a terminal (e.g. Terminal.app on macOS)

<!-- TODO write a short section about costs and AWS pricing -->

## Step 1: Set up AWS CLI v2

### Step 1-1: Install the AWS CLI

Check whether you already have the AWS CLI installed by running:

```bash
which aws
# either "aws not found" or "/usr/local/bin/aws"
aws --version
# either "zsh: command not found: aws"  or "aws-cli/2.24.16 Python/3.12.9 Darwin/21.6.0 exe/x86_64"
```

If the AWS CLI is not installed, install it by following the instructions at
<https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>.

For example, to install on macOS for all of your Mac's users (assuming you have
admin privileges on your Mac):

```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
#   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                  Dload  Upload   Total   Spent    Left  Speed
# 100 39.1M  100 39.1M    0     0  5002k      0  0:00:08  0:00:08 --:--:-- 5531k
# Password:
# installer: Package name is AWS Command Line Interface
# installer: Installing at base path /
# installer: The install was successful.
which aws
# /usr/local/bin/aws
aws --version
# aws-cli/2.24.16 Python/3.12.9 Darwin/21.6.0 exe/x86_64
```

### Step 1-2: Create your 'Access Key' and 'Secret Access Key'

Visit <https://us-east-1.console.aws.amazon.com/iam/home>, scroll down to the
'Quick links' section, and click the 'My security credentials' link.

Scroll to the 'Access keys (0)' section, click the 'Create access key' button,
note the “Root user access keys are not recommended” warning, tick the
“I understand creating a root access key is not a best practice ...” checkbox,
and click the 'Create access key' button.

Copy-paste the 'Access Key' and 'Secret Access Key' into a password manager, and
click 'Done'.

<!-- TODO: show best practice, by avoiding using a root access key -->

### Step 1-3: Configure the AWS CLI with your credentials

```bash
aws iam list-policies # just running this to check whether we have credentials
# Unable to locate credentials. You can configure credentials by running "aws configure".
aws configure
# AWS Access Key ID [None]: AKI**************4XJ
# AWS Secret Access Key [None]: oUl**********************************VqU
# Default region name [None]: eu-central-1
# Default output format [None]: json
cat ~/.aws/config
# [default]
# region = eu-central-1
# output = json
cat ~/.aws/credentials # you can rename to ~/.aws/credentials_HID to temporarily disable access
# [default]
# aws_access_key_id = AKI**************4XJ
# aws_secret_access_key = oUl**********************************VqU
aws sts get-session-token
# {
#     "Credentials": {
#         "AccessKeyId": "AKI**************4XJ",
#         "SecretAccessKey": "StZ**********************************27w",
#         "SessionToken": "...",
#         "Expiration": "2025- ... [in 1 hour's time] ...+00:00"
#     }
# }
aws iam list-policies --query 'Policies[].PolicyName' # can now list names of all policies
# [
#     "AWSLambdaBasicExecutionRole-01a887a4-b49f-4c83-9f1e-2a81316a8c7e",
# ...
```

Press `q` to exit the `aws iam list-policies` command.

## Step 2: Create a DynamoDB Table using AWS CLI

### Step 2-1: List existing DynamoDB tables, if any

```bash
aws dynamodb list-tables
# {
#     "TableNames": [
#         "some-pre-existing-dynamo-db-20250101"
#     ]
# }
```

### Step 2-2: Temporarily create a DynamoDB table

- `--attribute-definitions`: Defines the attributes for the table. In this case,
  we define an attribute named `Id` of type `String`.
- `--key-schema`: Defines the primary key for the table. In this case, we use
  `Id` as the partition key.
- `--provisioned-throughput`: Sets the read and write capacity units for the
   table. In this case, we set both to 5.

```bash
aws dynamodb create-table \
--table-name temporary-dynamodb-20250422 \
--attribute-definitions AttributeName=Id,AttributeType=S \
--key-schema AttributeName=Id,KeyType=HASH \
--provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
# {
#     "TableDescription": {
#         "AttributeDefinitions": [
#             {
#                 "AttributeName": "Id",
#                 "AttributeType": "S"
#             }
#         ],
#         "TableName": "temporary-dynamodb-20250422",
#         "KeySchema": [
#             {
#                 "AttributeName": "Id",
#                 "KeyType": "HASH"
#             }
#         ],
#         "TableStatus": "CREATING",
#         "CreationDateTime": "2025-04-22T...",
#         "ProvisionedThroughput": {
#             "NumberOfDecreasesToday": 0,
#             "ReadCapacityUnits": 5,
#             "WriteCapacityUnits": 5
#         },
#         "TableSizeBytes": 0,
#         "ItemCount": 0,
#         "TableArn": "arn:aws:dynamodb:eu-central-1:62********84:table/temporary-dynamodb-20250422",
#         "TableId": "a1b2c3d4-5e6f-a1b2-c3d4-5e6fa1b2c3d4",
#         "DeletionProtectionEnabled": false
#     }
# }
aws dynamodb list-tables
# {
#     "TableNames": [
#         "some-pre-existing-dynamo-db-20250101",
#         "temporary-dynamodb-20250422"
#     ]
# }
```

### Step 2-3: Insert sample data into the DynamoDB table and run a simple query

- `query`: Retrieves items from the table based on the specified key condition expression.
- `scan`: Retrieves all items from the table and applies a filter expression to limit the results.

```bash
# Add 3 user profiles to the DynamoDB table
aws dynamodb put-item \
--table-name temporary-dynamodb-20250422 \
--item '{
    "Id": {"S": "1"},
    "Name": {"S": "Alice"},
    "Age": {"N": "58"}
}'
aws dynamodb put-item \
--table-name temporary-dynamodb-20250422 \
--item '{
    "Id": {"S": "2"},
    "Name": {"S": "Bob"},
    "Age": {"N": "35"}
}'
aws dynamodb put-item \
--table-name temporary-dynamodb-20250422 \
--item '{
    "Id": {"S": "3"},
    "Name": {"S": "Charlie"},
    "Age": {"N": "28"}
}'
# (no output)

# Retrieve the user profile with Id 1
aws dynamodb query \
--table-name temporary-dynamodb-20250422 \
--key-condition-expression "Id = :id" \
--expression-attribute-values '{":id":{"S":"1"}}'
# {
#     "Items": [
#         {
#             "Id": {
#                 "S": "1"
#             },
#             "Age": {
#                 "N": "58"
#             },
#             "Name": {
#                 "S": "Alice"
#             }
#         }
#     ],
#     "Count": 1,
#     "ScannedCount": 1,
#     "ConsumedCapacity": null
# }

# List user profiles over age 30
aws dynamodb scan \
--table-name temporary-dynamodb-20250422 \
--filter-expression "Age > :age" \
--expression-attribute-values '{":age":{"N":"30"}}'
# {
#     "Items": [
#         {
#             "Id": {
#                 "S": "2"
#             },
#             "Age": {
#                 "N": "35"
#             },
#             "Name": {
#                 "S": "Bob"
#             }
#         },
#         {
#             "Id": {
#                 "S": "1"
#             },
#             "Age": {
#                 "N": "58"
#             },
#             "Name": {
#                 "S": "Alice"
#             }
#         }
#     ],
#     "Count": 2,
#     "ScannedCount": 3,
#     "ConsumedCapacity": null
# }
```

### Step 2-4: Delete the temporary DynamoDB table

```bash
aws dynamodb delete-table --table-name temporary-dynamodb-20250422
# {
#     "TableDescription": {
#         "TableName": "temporary-dynamodb-20250422",
#         "TableStatus": "DELETING",
#         "ProvisionedThroughput": {
#             "NumberOfDecreasesToday": 0,
#             "ReadCapacityUnits": 5,
#             "WriteCapacityUnits": 5
#         },
#         "TableSizeBytes": 0,
#         "ItemCount": 0,
#         "TableArn": "arn:aws:dynamodb:eu-central-1:62********84:table/temporary-dynamodb-20250422",
#         "TableId": "a1b2c3d4-5e6f-a1b2-c3d4-5e6fa1b2c3d4",
#         "DeletionProtectionEnabled": false
#     }
# }
aws dynamodb list-tables
# {
#     "TableNames": [
#         "some-pre-existing-dynamo-db-20250101",
#     ]
# }
```

### Step 2-5: Create the DynamoDB table which will contain the tally

> [!NOTE]
> Most of the resources created in this guide will be prefixed with
> `basic-dynamodb-lambda-api-20250422-`, so that they can be easily identified
> and deleted later. The `20250422` is the date in YYYYMMDD format, and
> `basic-dynamodb-lambda-api` part of the name is the name of this repository.
> 
> Different resources will have different suffixes - in this case, the `-table`
> suffix indicates that this is a DynamoDB table.

```bash
aws dynamodb create-table \
--table-name basic-dynamodb-lambda-api-20250422-table \
--attribute-definitions AttributeName=Id,AttributeType=S \
--key-schema AttributeName=Id,KeyType=HASH \
--provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
# {
#     "TableDescription": {
# ...
#         "TableArn": "arn:aws:dynamodb:eu-central-1:62********84:table/basic-dynamodb-lambda-api-20250422-table",
# ...
#     }
# }
```
