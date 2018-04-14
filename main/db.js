const MongoClient = require('mongodb').MongoClient

/*
 * 参考资料：
 * MongoDb：https://github.com/mongodb/node-mongodb-native
 *
 * Collection
 *     insertOne({a:1}); // insertedCount
 *     insertMany([{a:2}, {a:3}]);
 *     updateOne({a:1}, {$set: {b: 1}}); // matchedCount modifiedCount
 *     updateMany({a:2}, {$set: {b: 1}}, {upsert: true});
 *     deleteOne({a:1}); // deletedCount
 *     deleteMany({a:2});
 * */

const url = 'mongodb://localhost:27017';
const dbName = 'Scalar';

// let table = db.collection('table');
// let exam = db.collection('exam');

function DB(){
    this.client = null;
    this.db = null;
    this.userCol = null;
}

function User(stunum, password, name, sex, birthday, nation, academy, class_name, tel, table, mytable, exams, myexams, grade, todo){
    this.stunum = stunum;
    this.password = password;
    this.name = name;
    this.sex = sex;
    this.birthday = birthday;
    this.nation = nation;
    this.academy = academy;
    this.class_name = class_name;
    this.tel = tel;
    this.table = table;
    this.mytable = mytable;
    this.exams = exams;
    this.myexams = myexams;
    this.grade = grade;
    this.todo = todo;
}

/*
 * 连接到数据库，返回Promise<boolean>
 * 如果user表不存在，则新建user表，返回true
 * 否则返回false
 * */
DB.prototype.connect = async function connect(){
    return new Promise(async (resolve, reject) => {
        const self = this;
        this.client = await MongoClient.connect(url);
        this.db = this.client.db(dbName);
        this.userCol = this.db.collection('user');
        if(this.db.collection('feedback') == null){
            this.db.createCollection('feedback', null, (error, collection) => {
                if(error){
                    reject(error);
                }
            })
        }
        if(this.userCol == null){
            this.db.createCollection('user', null, (error, collection) => {
                if(error){
                    reject(error);
                }
                else{
                    self.userCol = collection;
                    resolve(true);
                }
            })
        }
        else{
            resolve(false);
        }
    });
}

DB.prototype.close = async function close(){
    await this.client.close();
}

////////////////////////////////////////////
// User
////////////////////////////////////////////
/*
 * 检验用户名和密码是否正确，成功返回1，失败返回0
 * stunum : 学号
 * password : 密码
 * 异常：用户名或密码不完整
 * 该用户不存在（应该在调用过register之后才能调用login）
 * 密码错误
 */
function login(stunum, password){
}
/*
 * 服务端在验证过密码可以登录教务网之后，调用该函数以在数据表中添加该用户的记录
 * stunum : 学号
 * password : 密码
 * 异常：用户名或密码不完整
 * 该用户已经存在
 */
DB.prototype.register = async function register(stunum, password, userInfo){
    let user = new User(stunum, password,
        userInfo.name, userInfo.sex, userInfo.birthday, userInfo.nation, userInfo.academy, userInfo.class_name);
    let r = await this.userCol.updateOne({stunum: stunum}, { $set: user }, { upsert: true });
    return true;
}

/*
 * 返回该用户的全部信息，包含课表考试和成绩
 * stunum : 学号
 * 异常：该用户不存在
 */
DB.prototype.getUserInfo = async function getUserInfo(stunum){
    let r = await this.userCol.findOne({stunum: stunum}, {
        projection:{
            "_id": 0
        }
    });
    return r;
}
////////////////////////////////////////////
// Table
////////////////////////////////////////////
DB.prototype.setTable = async function setTable(stunum, table){
    let r = await this.userCol.updateOne({stunum: stunum}, {$set: {table: table}});
    return r.modifiedCount == 1;
}

function setMyTable(stunum, table){

}

DB.prototype.getTable = async function getTable(stunum){
    let user = await getUserInfo(stunum);
    if(user){
        return user.table;
    }
    return null;
}
/*
 * 返回该用户的课表信息
 * stunum : 学号
 * 异常：该用户不存在
 * 不存在课表信息
 */
function getMyTable(stunum){

}
/*
 * 添加课程，并返回课表信息
 * stunum : 学号
 * course : 课程
 * 异常：该用户不存在
 */
function addCourse(stunum, course){

}
/*
 * 重置课表为初始课表，并返回课表信息
 * stunum : 学号
 * 异常：该用户不存在
 * 不存在初始课表
 */
function resetMyTable(stunum){

}
////////////////////////////////////////////
// Exam
////////////////////////////////////////////
DB.prototype.setExams = async function setExams(stunum, exams){
    let r = await this.userCol.updateOne({stunum: stunum}, {$set: {exams: exams}});
    return r.modifiedCount == 1;
}

function setMyExams(stunum, exams){

}

/*
 * 返回该用户的考试信息（ 包括教务系统的和自定义的考试）
 * stunum : 学号
 * 异常：该用户不存在
 * 不存在考试信息
 */
DB.prototype.getMyExam = async function getMyExam(stunum){
    let user = await getUserInfo(stunum);
    if(user){
        return user.exams;
    }
    return null;
}
/*
 * 为该户用添加一个考试信息，并返回当前考试列表
 * stunum : 学号
 * exam : 要添加的考试信息
 * 异常：该用户不存在
 */
function addExam(stunum, exam){

}
/*
 * 删除一条用户自定义的考试信息
 * stunum : 学号
 * exam : 要删除的考试信息
 * 异常：该用户不存在
 * 不存在考试信息
 */
function removeExam(stunum, exam){

}
////////////////////////////////////////////
// Grade
////////////////////////////////////////////

DB.prototype.setGrade = async function setGrade(stunum, grade){
    let r = await this.userCol.updateOne({stunum: stunum}, {$set: {grade: grade}});
    return r.modifiedCount == 1;
}
/*
 * 返回该用户的所有成绩信息
 * stunum : 学号
 * 异常：该用户不存在
 * 不存在成绩信息
 */
DB.prototype.getGrade = async function getGrade(stunum){
    let user = await getUserInfo(stunum);
    if(user){
        return user.grade;
    }
    return null;
}

DB.prototype.setCookie = async function setCookie(stunum, password, host, cookie, last_login){
    let r = await this.privacyCol.updateOne({stunum:stunum}, {
        $set: {
            password: password,
            host: host,
            cookie: cookie,
            last_login: last_login
        }
    }, {upsert: true})
    return true;
}

DB.prototype.getCookie = async function getCookie(stunum){
    let r = await this.privacyCol.findOne({stunum:stunum})
    return r;
}

const COOKIE_CACHE_AGE = 3600 * 1000;
DB.prototype.obtainCookie = async function getCookie(stunum, host){
    let r = await getCookie(stunum);
    if(r && r.cookie && r.host == host){
        if(Date.now() - r.last_login < COOKIE_CACHE_AGE){
            return r.cookie;
        }
    }
    else{
        return null;
    }
}

DB.prototype.like = async function like(stunum) {
    let r = await this.userCol.updateOne({stunum: stunum}, {$set: {like: 1}});
    return this.userCol.find({like: 1}).count();
}

DB.prototype.uploadFeedback = async function uploadFeedback(stunum, message, stackTrack) {
    let r = await this.db.collection('feedback').insertOne({stunum: stunum, message: message, stack_track: stackTrack});
    return true;
}

DB.prototype.getFeedbacks = async function getFeedbacks() {
    let r = await this.db.collection('feedback').find({}, {
        projection:{
            "_id": 0
        }
    }).toArray();
    return r;
}

// Exports

module.exports = DB;
