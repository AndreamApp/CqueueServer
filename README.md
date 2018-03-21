# TableServer

搭建第三方服务器，提供开放的重大教务网接口，如课表、成绩、考试查询接口。

## 环境准备

1. MongoDb

yum -y install mongodb-org

2. Node.js

yum -y install nodejs

3. 源码下载

yum -y install git-core
git clone "https://github.com/AndreamApp/TableServer.git"
cd TableServer
npm install

## 开始使用

1. 启动MongoDb

mkdir -p /data/mongodata
mongod --dbpath /data/mongodata

2. 启动node服务器

node TableServer/app

## Lisence

MIT
