# TableServer

搭建第三方服务器，提供开放的重大教务网接口，如课表、成绩、考试查询接口。

## 环境准备

1. MongoDb

```shell
yum -y install mongodb-org
```

2. Node.js

```shell
yum -y install nodejs
```

3. 源码下载

```shell
yum -y install git-core
git clone "https://github.com/AndreamApp/TableServer.git"
cd TableServer
npm install
```

## 开始使用

1. 启动MongoDb

```shell
mkdir -p /data/db
mongod --dbpath /data/db
```

2. 启动node服务器

```shell
node TableServer/app
```

## Lisence

MIT
