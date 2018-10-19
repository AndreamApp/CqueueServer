module.exports = {
    FullCourse: function (course_name, course_code, credit, hours_all, hours_teach, hours_practice, teacher, class_no, student_cnt, class_detail, acadamy, is_exp){
        this.course_name = course_name;
        this.course_code = course_code;
        this.credit = credit;
        this.hours_all = hours_all;
        this.teacher = teacher;
        this.schedule = []; // 上课周次节次地点
        this.class_no = class_no;
        this.student_cnt = student_cnt;
        this.class_detail = class_detail;
        this.academy = acadamy;
        this.is_exp = is_exp; // 是否实验课
    }
};
