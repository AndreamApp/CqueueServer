var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var https = require('https');
var fs = require('fs');
let RateLimit = require('express-rate-limit');
let session = require('express-session');
let MongoStore = require('connect-mongo')(session);

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));

// rate limit
var limiter = new RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    delayMs: 0, // disable delaying - full speed until the max limit is reached
    message: "{status: false,err: \"请求太快了！休息一下吧\",data:null}"
});
app.use(limiter);

// session & store
app.use(session({
    name: 'cqulite_session',
    secret: '976655631',
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000
    },
    store: new MongoStore({ url: 'mongodb://localhost:27017/session'}),
    resave: false,
    saveUninitialized: false
}));

app.use('/api/v1', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

var options = {
    cert: fs.readFileSync(__dirname  + "/key/cert.pem"),
    key: fs.readFileSync(__dirname  + "/key/key.pem"),
    passphrase: "andreamApp97"
};
var server = https.createServer(options, app);

server.listen(443, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("应用实例，访问地址为 http://%s:%s", host, port)
});

// var httpServer = app.listen(80, function () {
//     var host = httpServer.address().address
//     var port = httpServer.address().port
//     console.log("应用实例，访问地址为 http://%s:%s", host, port)
// });

module.exports = app;
