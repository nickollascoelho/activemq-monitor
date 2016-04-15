var gulp = require('gulp');
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var fs = require('fs');
var runSequence = require('run-sequence').use(gulp);
var config = require('dotenv').config();

AWS.config.region = config.AWS_REGION;

// First we need to clean out the dist folder and remove the compiled zip file.
gulp.task('clean', function(cb) {
    return del('./dist',
        del('./dist.zip', cb)
    );
});

// The js task could be replaced with gulp-coffee as desired.
gulp.task('js', function() {
    return gulp.src('index.js')
        .pipe(gulp.dest('dist/'));
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
    return gulp.src('./package.json')
        .pipe(gulp.dest('./dist/'))
        .pipe(install({
            production: true
        }));
});

// Next copy over environment variables managed outside of source control.
gulp.task('env', function() {
    return gulp.src('./.env')
        .pipe(gulp.dest('./dist'));
});

// Now the dist directory is ready to go. Zip it.
gulp.task('zip', function() {
    return gulp.src(['dist/**/*', '!dist/package.json', 'dist/.*'])
        .pipe(zip('dist.zip'))
        .pipe(gulp.dest('./'));
});

gulp.task('setup', function() {
    var cloudwatchlogs = new AWS.CloudWatchLogs({
        apiVersion: '2014-03-28'
    });

    cloudwatchlogs.createLogGroup({
        logGroupName: config.AWS_LOG_GROUP_NAME
    }, function(err, data) {
        if (err) console.log(err, err.stack);
        else console.log(data);
    });

    var cloudwatchevents = new AWS.CloudWatchEvents({
        apiVersion: '2015-10-07'
    });

    //TODO setup a cloud watch scheduled event to execute the lambda function
    //TODO setup a couple of log metrics to catch problems

});

gulp.task('upload', function() {
    var lambda = new AWS.Lambda({
        apiVersion: '2015-03-31'
    });

    var functionName = 'activemqLogger';

    lambda.getFunction({
        FunctionName: functionName
    }, function(err, data) {
        if (err) {
            var warning = '';
            if (err.statusCode === 404) {
                warning = 'Unable to find lambda function ' + deploy_function + '. ';
                warning += 'Verify the lambda function name and AWS region are correct.';
            } else {
                warning = 'AWS API request failed. ';
                warning += 'Check your AWS credentials and permissions.';
            }
            console.log(warning);
            console.log(err, err.stack);
            return;
        }

        // This is a bit silly, simply because these five parameters are required.
        var current = data.Configuration;
        var params = {
            FunctionName: functionName,
            Publish: true
        };

        fs.readFile('./dist.zip', function(err, data) {
            params.ZipFile = data;
            lambda.updateFunctionCode(params, function(err, data) {
                if (err) {
                    var warning = 'Package upload failed. ';
                    warning += 'Check your iam:PassRole permissions.';
                    console.log(warning);
                }
            });
        });
    });
});

gulp.task('deploy', function(callback) {
    runSequence('package', 'upload', callback);
});

gulp.task('package', function(callback) {
    runSequence('clean', ['js', 'npm', 'env'], 'zip', callback);
});

gulp.task('default', function(callback) {
    runSequence('package');
});
