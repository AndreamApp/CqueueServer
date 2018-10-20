const htmlparser = require("htmlparser2");
const { FullCourse } = require('./bean');

String.prototype.replaceAll = function(search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

/*
 * UserInfo对象，包含学生个人信息
 * stunum:      学号
 * name:        姓名
 * sex:         性别
 * birthday:    生日
 * nation:      民族
 * academy:     学院
 * class_name:  行政班级
 */
function UserInfo(stunum, name, sex, birthday, nation, academy, class_name){
    this.stunum = stunum;
    this.name = name;
    this.sex = sex;
    this.birthday = birthday;
    this.nation = nation;
    this.academy = academy;
    this.class_name = class_name;
}

/*
 * Course，包含课程信息
 * course_name:      课程名称
 * course_code:      课程代码
 * credit:           学分
 * hours_all:        总学时
 * hours_teach:      讲授学时
 * hours_practice:   上机学时
 * teacher:          老师
 */
function Course(course_name, course_code, credit, hours_all, hours_teach, hours_practice, teacher){
    this.course_name = course_name;
    this.course_code = course_code;
    this.credit = credit;
    this.hours_all = hours_all;
    this.hours_teach = hours_teach;
    this.hours_practice = hours_practice;
    this.teacher = teacher;
    this.schedule = [];
}

/*
 * course_name : "概率论与数理统计",
 * course_code : "MATH20001",
 * credit : 3,
 * time_str : "2017-12-10(14周 星期日)09:00-11:00",
 * start_time : "2017-12-10 09:00:00",
 * end_time : "2017-12-10 11:00:00",
 * classroom : "D区D一教学楼D1349",
 * seat : "12"
 */
function Exam(course_name, course_code, credit, time_str, start_time, end_time, classroom, seat){
    this.course_name = course_name;
    this.course_code = course_code;
    this.credit = credit;
    this.time_str = time_str;
    this.start_time = start_time;
    this.end_time = end_time;
    this.classroom = classroom;
    this.seat = seat;
}

function SemesterGrade(semester, gpa, data){
    this.semester = semester;
    this.gpa = gpa;
    this.data = data;
}

function Grade(course_name, course_code, credit, grade){
    this.course_name = course_name;
    this.course_code = course_code;
    this.credit = credit;
    this.grade = grade;
}

function Parser(){

}

/*
 * 从HTML中提取用户个人信息，返回UserInfo对象
 * content: 网页内容
 * 返回Promise<UserInfo>
 */
Parser.prototype.parseInfoFromHTML = async function parseInfoFromHTML(content){
    return new Promise(async function (resolve, reject){
        let user = new UserInfo();
        let parser = new htmlparser.Parser({
            lastText: '',
            onopentag: function(name, attribs){
                if(name.toLowerCase() === "html"){
                }
            },
            ontext: function(text){
                switch (this.lastText){
                    case '学号':
                        user.stunum = text;
                        break;
                    case '姓名':
                        user.name = text;
                        break;
                    case '性别':
                        user.sex = text;
                        break;
                    case '出生日期':
                        user.birthday = text;
                        break;
                    case '民族':
                        user.nation = text;
                        break;
                    case '院(系)/部':
                        user.academy = text;
                        break;
                    case '行政班级':
                        user.class_name = text;
                        break;
                }
                this.lastText = text;
            },
            onclosetag: function(tagname){
                if(tagname.toLowerCase() === "html"){
                    resolve(user);
                }
            }
        }, {decodeEntities: true});
        parser.write(content.replaceAll('&nbsp;', '').replaceAll(' ', ''));
        parser.end();
    });
};

/*
 * 解析课程表的解析器函数，根据输入的html，resolve一个Course数组
 * 要求数据保存在table中，要求每一行拥有相同的列数，在thead中指明列名，需要包含以下几个列：
 * 课程 学分 总学时 讲授学时 上机学时 任课教师 时间 地点
 * 要求每一个表中的数据要对齐，`周次 节次 地点`必须按照这个顺序出现，具体格式可以参考table_rpt.html
 */
function getTableParser(resolve, reject){
    return {
        currentTag: '',                 // 记录当前在解析的标签，值可为thead或tbody
        rowIndex: 0,                    // 记录当前解析的列号，联合keyTransformer得到字段的key
        courses:[],                     // 保存已经解析的课程
        currentCourse:'',               // 保存当前正在解析的课程
        appendingSchedule: false,       // 记录是否在解析同一课程的时间表（一个课程的完整时间表可能需要解析多行）
        // 用于根据列表表头，生成key转换器，例如将'课程'转换为'course_name'
        // 之后遍历tr时，借助keyTransformer可以按key保存数据
        keyTransformer: '',             // 将表格的列名转换为key的数组
        transform: function(text){
            switch(text){
                case '课程':
                    return 'course_name';
                case '学分':
                    return 'credit';
                case '总学时':
                    return 'hours_all';
                case '讲授学时':
                    return 'hours_teach';
                case '上机学时':
                    return 'hours_practice';
                case '任课教师':
                    return 'teacher';
                case '时间':
                    // 跳过时间节点的处理，因为它还有特殊子节点
                    return null;
                case '地点':
                    return 'classroom';
                default:
                    return null;
            }
        },
        onopentag: function(name, attribs){
            switch(name.toLowerCase()){
                case 'thead':
                    this.currentTag = 'thead';
                    this.keyTransformer = []; // 最多不会超过15个键
                    break;
                case 'tbody':
                    this.currentTag = 'tbody';
                    break;
                case 'tr':
                    this.rowIndex = -1;
                    break;
                case 'td':
                    if(this.currentTag === 'tbody'){
                        if(this.keyTransformer[this.rowIndex] === 'course_name'){
                            // 追加课程
                            if(attribs['hidevalue']){
                                this.appendingSchedule = true;
                            }
                            // 开启新课程
                            else{
                                this.appendingSchedule = false;
                            }
                        }
                        this.rowIndex++;
                    }
                    break;
            }
        },
        ontext: function(text){
            //console.log(this.currentTag, text);
            switch(this.currentTag){
                // 生成keyTansformer
                case 'thead':
                    if('时间' === text){
                        // 跳过时间节点，用周次和节次替换
                        this.keyTransformer.push('weeks');
                        this.keyTransformer.push('classtime');
                    }
                    else{
                        this.keyTransformer.push(this.transform(text));
                    }
                    break;
                // 生成课表数据
                case 'tbody':
                    let key = this.keyTransformer[this.rowIndex];
                    switch(key){
                        case 'weeks':
                            this.currentCourse.schedule.push({
                                weeks: text,
                                classtime:'',
                                classroom:''
                            });
                            break;
                        case 'classtime':
                            this.currentCourse.schedule[this.currentCourse.schedule.length-1].classtime = text;
                            break;
                        case 'classroom':
                            this.currentCourse.schedule[this.currentCourse.schedule.length-1].classroom = text;
                            break;
                        default:
                            if(key === 'course_name'){
                                if(this.currentCourse.course_name !== text){
                                    let code = text.substring(text.indexOf('[') + 1, text.indexOf(']'));
                                    let name = text.substring(text.indexOf(']') + 1);
                                    if(this.currentCourse){
                                        this.courses.push(this.currentCourse);
                                    }
                                    this.currentCourse = new Course(name, code);
                                }
                            }
                            else if(key && text){
                                this.currentCourse[key] = text;
                            }
                            break;
                    }
                    break;
            }
        },
        onclosetag: function(tagname){
            if(tagname === 'thead'){
                this.currentTag = null;
            }
            if(tagname === 'tbody'){
                this.currentTag = null;
            }
            if(tagname === 'html'){
                resolve(this.courses);
            }
        }
    }
}

/*
 * 从HTML中提取用户课表信息，返回Table对象
 * content: 网页内容
 * 返回Promise<Array<Course>>
 */
Parser.prototype.parseTableFromHTML = async function parseTableFromHTML(content){
    return new Promise((resolve, reject) => {
        let parser = new htmlparser.Parser(getTableParser(resolve, reject), {decodeEntities: true});
        // 去掉换行
        parser.write(content.replaceAll('<br>', ''));
        parser.end();
    });
};

/*
 * 解析一个html页面，返回一个tbody的数组，数组层级为：tbody[] -> tr[] -> td[] -> {value, attrs} （三维数组）
 * keepattrs: 想要保留的td的属性，默认为null即保留所有属性
 */
function getGeneralTBodyParser(resolve, reject, keepattrs){
    return {
        currentTag: '', // mark tag is <tbody> or <tr>
        tempHtml: null,
        tempTody: null,
        tempTr: null,
        tempTd: null,
        onopentag: function(name, attributes){
            switch (name.toLowerCase()){
                case 'html':
                    this.currentTag = 'html';
                    this.tempHtml = [];
                    break;
                case 'table':
                    this.currentTag = 'table';
                    this.tempTody = [];
                    break;
                case 'tr':
                    this.currentTag = 'tr';
                    // reset columnIndex
                    this.columnIndex = 0;
                    this.tempTr = [];
                    break;
                case 'td':
                    this.currentTag = 'td';
                    // 筛选指定的key
                    if(keepattrs != null){
                        let keep = {};
                        for(let k in attributes){
                            if(keepattrs.indexOf(k) >= 0){
                                keep[k] = attributes[k];
                            }
                        }
                        attributes = keep;
                    }
                    this.tempTd = {
                        value: '',
                        attrs: attributes
                    };
                    break;
            }
        },
        ontext: function(text){
            if(this.currentTag === 'td'){
                this.tempTd.value = text;
            }
        },
        onclosetag: function(name){
            switch (name.toLowerCase()){
                case 'html':
                    this.currentTag = '';
                    resolve(this.tempHtml);
                    break;
                case 'table':
                    this.currentTag = '';
                    this.tempHtml.push(this.tempTody);
                    break;
                case 'tr':
                    this.currentTag = '';
                    this.tempTody.push(this.tempTr);
                    break;
                case 'td':
                    this.currentTag = '';
                    this.tempTr.push(this.tempTd);
                    break;
            }
        }
    }
}

/*
 * 从html中解析出Exam数组（借助getGeneralTBodyParser）
 * text: 待解析的html
 * 返回Array<Exam>
 */
Parser.prototype.parseExamsFromHTML = async function parseExamsFromHTML(text){
    let generalData = await new Promise(function (resolve, reject){
        let parser = new htmlparser.Parser(getGeneralTBodyParser(resolve, reject, []), {decodeEntities: true});
        // 去掉换行
        parser.write((text).replaceAll('<br>', ''));
        parser.end();
    });
    let examList = [];
    for(let i = 0; i < generalData.length; i++){
        let table = generalData[i];
        // 标题行
        if(table.length === 1 && table[0].length === 3){
            i++; // 跳过列名行
            continue;
        }
        // 考试数据
        for(let j = 0; j < table.length; j++){
            let tr = table[j];
            let exam = new Exam();
            let name = tr[1].value; // [EDS20502]科技翻译
            exam.course_name = name.substring(name.indexOf(']') + 1); // 科技翻译
            exam.course_code = name.substring(name.indexOf('[') + 1, name.indexOf(']')); //EDS20502
            exam.credit = tr[2].value; // 2
            exam.time_str = tr[5].value; // 2018-01-17(20周 星期三)14:30-16:30
            // parse time
            let t = tr[5].value;
            let date = t.substring(0, t.indexOf('('));
            exam.start_time = date + ' ' + t.substring(t.indexOf(')') + 1, t.lastIndexOf('-')) + ':00'; // 2018-01-17 14:30:00
            exam.end_time = date + ' ' + t.substring(t.lastIndexOf('-') + 1) + ':00'; // 2018-01-17 16:30:00

            exam.classroom = tr[6].value; // D区D一教学楼D1143
            exam.seat = tr[7].value; // 5
            examList.push(exam);
        }
    }
    return examList;
};

/*
 * 从html数组中解析考试数据
 * htmlArr: html数组
 * 返回Array<Exam>
 */
Parser.prototype.parseExamsFromHTMLArr = async function parseExamsFromHTMLArr(htmlArr){
    let arr = [];
    for(let i = 0; i < htmlArr.length; i++){
        let examTable = await this.parseExamsFromHTML(htmlArr[i]);
        arr = arr.concat(examTable);
    }
    return arr;
};

/*
 * 从html中解析出Grade数组（借助getGeneralTBodyParser）
 * text: 待解析的html
         [
            semester : "2015-2016学年 第一学期",
            gpa : 3.12,
            data : [
                {
                    code : "MATH20001",
                    course_name : "概率论与数理统计",
                    score : 3.00,
                    grade : 90,
                    note : "类别：公共基础/必修\n考核方式：考试\n修读性质：初修\n辅修标记：主修"
                },
                {
                    code : "MATH20002",
                    course_name : "高等数学",
                    score : 5.00,
                    grade : 90,
                    note : "类别：公共基础/必修\n考核方式：考试\n修读性质：初修\n辅修标记：主修"
                }
            ]
        ]
   返回Array<SemesterGrade>
 */

/**
 * calculate the gpa of this semester, under these rules:
 * skip 未录入 item
 * 优秀=95 良好=85 中等=75 合格=65 不合格=60
 * TODO: 体育课和新生研讨课这些只有两级制：合格/不合格
 * semester.gpa设置为保留两位有效数字的小数
 * 返回gpa为float类型
 */
function calcGpa(semester){
    let totalCredit = 0;
    let totalGrade = 0;
    for(let i = 0; i < semester.data.length; i++){
        let credit = parseFloat(semester.data[i].credit);
        let grade = 0;
        switch (semester.data[i].grade){
            case "未录入":
                continue;
            case "优秀":
                grade = 95;
                break;
            case "良好":
                grade = 85;
                break;
            case "中等":
                grade = 75;
                break;
            case "合格":
                grade = 85; // TODO
                break;
            case "不合格":
                grade = 0;
                break;
            default:
                grade = parseFloat(semester.data[i].grade, 10);
                break;
        }
        if(grade < 60){
            grade = 60;
        }
        if(grade > 90){
            grade = 90;
        }
        totalCredit += credit;
        totalGrade += credit * (grade - 50) / 10;
    }
    let gpa = totalGrade / totalCredit;
    semester.gpa = gpa.toFixed(2);
    return gpa;
}

Parser.prototype.parseGradesFromHTML = async function parseGradesFromHTML(text){
    let generalData = await new Promise(function (resolve, reject){
        let parser = new htmlparser.Parser(getGeneralTBodyParser(resolve, reject, []), {decodeEntities: true});
        // 去掉换行
        // 因为包含学期名字的Table没有</table>标签！出此下策
        parser.write((text).replaceAll('<br>', '').replaceAll('学期</td></tr>', '学期</td></tr></table>'));
        parser.end();
    });
    let gradeList = [];
    for(let i = 1; i < generalData.length; i++){ // i=1开始，忽略名字table
        let table = generalData[i];
        // 标题行
        let currSemester = new SemesterGrade();
        currSemester.semester = table[0][0].value;
        currSemester.semester = currSemester.semester.replaceAll('学年学期：', '');
        currSemester.semester = currSemester.semester.replaceAll('学年学期:', '');
        currSemester.data = [];

        i++;
        table = generalData[i];
        // 考试数据
        for(let j = 1; j < table.length; j++){ // j=1开始，忽略列名tr
            let tr = table[j];
            let grade = new Grade();
            let name = tr[1].value; // [EDS20502]科技翻译
            grade.course_name = name.substring(name.indexOf(']') + 1); // 科技翻译
            grade.course_code = name.substring(name.indexOf('[') + 1, name.indexOf(']')); //EDS20502
            grade.credit = tr[2].value; // 2
            grade.grade = tr[6].value; // 78
            currSemester.data.push(grade);
        }
        // 计算gpa
        calcGpa(currSemester);
        gradeList.push(currSemester);
    }
    return gradeList;
};

// REALLY HARD CODE! REALLY UGLY!
Parser.prototype.parseCourseFromHTML = async function parseCourseFromHTML(text){
    let generalData = await new Promise(function (resolve, reject){
        let parser = new htmlparser.Parser(getGeneralTBodyParser(resolve, reject, []), {decodeEntities: true});
        // 去掉换行
        // 因为包含学期名字的Table没有</table>标签！出此下策
        // 因为table的每一行缺少<tr>开始标签，出此下策
        parser.write((text)
            .replaceAll('<br>', '')
            .replaceAll('</tr><td', '</tr><tr><td')
            .replaceAll('&nbsp;', ' ') // for basic info line. eg. 承担单位：航空航天学院  课程：[AEME30230]计算力学  总学时：40.0  总学分：2.50
            .replaceAll('学期</td></tr>', '学期</td></tr></table>'));
        parser.end();
    });
    // console.log(JSON.stringify(generalData, null, 4));
    let courseList = [];
    if(generalData.length <= 2) { // Doesn's have any course schedule
        return courseList;
    }
    // Description
    let description = generalData[2][0][0].value;

    let academy, code, name, hours_all, credit;
    let is_exp = description.endsWith('实验');
    description.split(' ').forEach( text => {
        if(text && text.indexOf('：') !== -1) {
            if('承担单位' === text.split('：')[0]) {
                academy = text.split('：')[1];
            }
            else if('课程' === text.split('：')[0]) {
                let course_text = text.split('：')[1];
                code = course_text.substring(course_text.indexOf('[') + 1, course_text.indexOf(']'));
                name = course_text.substring(course_text.indexOf(']') + 1);
            }
            else if('总学时' === text.split('：')[0]) {
                hours_all = text.split('：')[1];
            }
            else if('总学分' === text.split('：')[0]) {
                credit = text.split('：')[1];
            }
        }
    });

    let table = generalData[3];
    for(let j = 1; j < table.length; ) {
        let tr = table[j];
        let course = new FullCourse();
        // general attributes
        [course.academy, course.course_code, course.course_name, course.hours_all, course.credit, course.is_exp] =
            [academy, code, name, hours_all, credit, is_exp];
        // specific attributes
        [course.teacher, course.class_no, course.student_cnt, course.class_detail] =
            [tr[1].value, tr[2].value, tr[3].value, tr[4].value];
        // schedules
        do{
            course.schedule.push({
                weeks: table[j][5].value,
                classtime: table[j][6].value,
                classroom: table[j][7].value,
            });
            j++;
        }
        while(j < table.length && !table[j][1].value);
        courseList.push(course);
    }

    // Experiment courses
    if(generalData.length === 6) {
        is_exp = true;
        table = generalData[5];
        for(let j = 1; j < table.length; ) {
            let tr = table[j];
            let course = new FullCourse();
            // general attributes
            [course.academy, course.course_code, course.course_name, course.hours_all, course.credit, course.is_exp] =
                [academy, code, name, hours_all, credit, is_exp];
            // specific attributes
            [course.teacher, course.class_no, course.student_cnt, course.class_detail] =
                [tr[2].value, tr[4].value, tr[5].value, ''];
            // schedules
            do{
                course.schedule.push({
                    weeks: table[j][6].value,
                    classtime: table[j][7].value,
                    classroom: table[j][8].value,
                });
                j++;
            }
            while(j < table.length && !table[j][2].value);
            courseList.push(course);
        }
    }

    return courseList;
};

async function synctest(){
    const Crawler = require('./crawler');
    const assert = require('assert');
    let crawler = new Crawler(null, '20151597');
    let parser = new Parser();
    console.time('parse');

    await crawler.login('20151597', '6897223B257F99DE268F847034BB01');

    // let infoHtml = await crawler.info();
    // console.log(JSON.stringify(await parser.parseInfoFromHTML(infoHtml)));
    //
    // let tableHtml = await crawler.table('20180');
    // console.log(JSON.stringify(await parser.parseTableFromHTML(tableHtml)));
    //
    // let examsHtml = await crawler.exams('20180');
    // console.log(JSON.stringify(await parser.parseExamsFromHTMLArr(examsHtml)));
    //
    // let gradeHtml = await crawler.grade();
    // console.log(JSON.stringify(await parser.parseGradesFromHTML(gradeHtml)));

    let courseHtml = await crawler.course(378214);
    let courseList = await parser.parseCourseFromHTML(courseHtml);
    let expected = [ {
        course_name: '计算力学', course_code: 'AEME30230', credit: '2.50', hours_all: '40.0',
        teacher: '严波', class_no: '001', student_cnt: '54', class_detail: '16工程力学01 16工程力学02',
        academy: '航空航天学院', is_exp: false,
        schedule: [
            { weeks: "6-15", classtime: "二[5-6节]", classroom: "A8312" },
            { weeks: "6-15", classtime: "五[1-2节]", classroom: "A8312" }
        ]
    } ];
    assert.deepEqual(courseList, expected);

    const DB = require('./db');
    let db = new DB();
    await db.connect();

    for(let course of courseList) {
        db.addCourse(course);
    }

    courseHtml = await crawler.course('000486');
    courseList = await parser.parseCourseFromHTML(courseHtml);
    console.log(JSON.stringify(courseList, null, 4));

    for(let course of courseList) {
        db.addCourse(course);
    }

    console.timeEnd('parse');
}

function asynctest(){
    const Crawler = require('./crawler');
    let crawler = new Crawler(null, '20151597');
    let parser = new Parser();
    console.time('parseInfo');
    console.time('parseTable');
    console.time('parseExams');
    console.time('parseGrade');

    crawler.info().then(async infoHtml => {
        console.log(JSON.stringify(await parser.parseInfoFromHTML(infoHtml)));
        console.timeEnd('parseInfo');
    });

    crawler.table('20180').then(async tableHtml => {
        console.log(JSON.stringify(await parser.parseTableFromHTML(tableHtml)));
        console.timeEnd('parseTable');
    });

    crawler.exams('20180').then(async examsHtml => {
        console.log(JSON.stringify(await parser.parseExamsFromHTMLArr(examsHtml)));
        console.timeEnd('parseExams');
    });

    crawler.grade().then(async gradeHtml => {
        console.log(JSON.stringify(await parser.parseGradesFromHTML(gradeHtml)));
        console.timeEnd('parseGrade');
    });

    // crawler.course(378214).then(async courseHtml => {
    //     console.log(JSON.stringify(await parser.parseCourseFromHTML(courseHtml)));
    //     console.timeEnd('parseGrade');
    // });
}

async function crawlAllCourses() {
    const Crawler = require('./crawler');
    const DB = require('./db');
    const iconv = require('iconv-lite');
    const fs = require('fs');
    const sleep = ms => new Promise( res => setTimeout(res, ms));
    let crawler = new Crawler('http://202.202.1.41', '20151597');
    await crawler.login('20151597', '6897223B257F99DE268F847034BB01');
    let parser = new Parser();
    let db = new DB();
    await db.connect();
    // db.clearCourse();

    let content = fs.readFileSync('../courses.txt');
    let arr = iconv.decode(content, 'utf-8').split('\n');
    for(let i = 1617; i < arr.length; i++){
        let course = arr[i];
        if(course) {
            let id = course.split(' ')[0];
            console.log(i + ': ' +course);

            let courseHtml = await crawler.course(id);
            let courseList = await parser.parseCourseFromHTML(courseHtml);

            for(let c of courseList) {
                await db.addCourse(c);
            }

            await sleep(500);
        }
    }
}

// asynctest();
// synctest();
// crawlAllCourses();

// Exports
module.exports = Parser;
