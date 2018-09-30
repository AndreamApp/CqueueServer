let mongoose = require('mongoose');
let Schema    = mongoose.Schema;
let ObjectId  = Schema.ObjectId;
let BaseModel = require('./base_model');

mongoose.connect('mongodb://127.0.0.1/Scalar', {
    server: {poolSize: 20}
}, function (err) {
    if (err) {
        console.error('connect to %s error: ', 'mongodb://127.0.0.1/Scalar', err.message);
        process.exit(1);
    }
});

let UserSchema = new Schema({
    stunum: { type: String },
    password: { type: String },
    name: { type: String },
    sex: { type: String },
    birthday: { type: String },
    nation: { type: String },
    academy: { type: String },
    class_name: { type: String },
    tel: { type: String },
    table: { type: ObjectId },
    mytable: { type: ObjectId },
    exams: { type: ObjectId },
    myexams: { type: ObjectId },
    grade: { type: ObjectId },
    todo: { type: ObjectId },
    like: { type: Boolean },
    // has_read: { type: Boolean, default: false },
    // create_at: { type: Date, default: Date.now }
});
// UserSchema.plugin(BaseModel);
// UserSchema.index({master_id: 1, has_read: -1, create_at: -1});


let CrashSchema = new Schema({
    stunum: { type: String },
    data: { type: String },
    // has_read: { type: Boolean, default: false },
    // create_at: { type: Date, default: Date.now }
});

let FeedbackSchema = new Schema({
    stunum: { type: String },
    message: { type: String },
    stack_track: { type: String },
});

let ChannelSchema = new Schema({
    // basic information
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    avator: { type: String, default: '' },
    creator: { type: ObjectId },
    tab: { type: String },
    create_at: { type: Date, default: Date.now },
    update_at: { type: Date, default: Date.now },
    // channel content
    subscribe_count: { type: Number, default: 0 },
    commit_count: { type: Number, default: 0 },
    // commitList: { type: Array, default: [] },
    // subscriber: { type: Array, default: [] },
    // channel state
    // top: { type: Boolean, default: false }, // 置顶频道
    // good: {type: Boolean, default: false }, // 精华频道
    access: {type: String, default: 'protected'}, // public: 每个人都可以push commit; protected: 只有creator可以push
    deleted: {type: Boolean, default: false},
    // access control
    ACL: { type: Array, default: [] },
});
ChannelSchema.plugin(BaseModel);
ChannelSchema.index({create_at: -1}); // query newest channels
ChannelSchema.index({name: -1}); // search channels by name

let CommitSchema = new Schema({
    content: { type: String },
    creator: { type: ObjectId },
    channel: { type: ObjectId },
    ACL: { type: Array },
    create_at: { type: Date, default: Date.now },
    update_at: { type: Date, default: Date.now },
    deleted: {type: Boolean, default: false},
});
CommitSchema.plugin(BaseModel);

exports.User = mongoose.model('user', UserSchema);
exports.Crash = mongoose.model('crash', CrashSchema);
exports.Feedback = mongoose.model('feedback', FeedbackSchema);

