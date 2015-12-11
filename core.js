var ACTIONS = {
	REGISTER: 1,
	LOGIN: 2
};

var SETTINGS = {
	MYSQL: {
		HOST_NAME: "anlagehub.com",
		DATABASE: "anlageme_lingu",
		USER: "anlageme_lingu",
		PASSWORD: "agrav_lingu22!"
	}
};

var Q = require('q');
var mysql = require('mysql');
var mysqlConn = mysql.createConnection({
	host: SETTINGS.MYSQL.HOST_NAME,
	user: SETTINGS.MYSQL.USER,
	password: SETTINGS.MYSQL.PASSWORD,
	database: SETTINGS.MYSQL.DATABASE
});

var io = require('socket.io')(8080);
io.on('connection', function (socket) {
	console.log("person connected");
	socket.on('message', function (message, fn) {
		console.log(message);
		onMessageReceived(message, socket, fn);
	});

	socket.on('disconnect', function () {

	});
});

function onMessageReceived(msg, socket, fn) {
	var request = JSON.parse(msg);

	// is this a valid request?
	if (request.action) {
		var res = processRequest(request, socket);
		console.log(typeof res);
		if (res) {
			res.then(
				function (result) {
					console.log("gonna emit: " + result);
					fn(JSON.stringify(result));
				}, function (error) {
					console.log("failed: " + error);
					fn(JSON.stringify(error));
				}
			);
		}

	}
}

function processRequest(request, socket) {
	switch (request.action) {
		case ACTIONS.LOGIN:
			return handleLogin(request, socket);
			break;
	}
}

function handleLogin(request, socket) {
	var defer = Q.defer();

	// handle login here..
	try {
		//mysqlConn.connect();

		var sql = "SELECT p.id_player FROM player p WHERE p.username = '" + request.username +
			"' AND p.password = MD5('" + request.password + "')";

		mysqlConn.query(sql, function (err, rows, fields) {
			if (err) {
				console.log(err);
				defer.reject(err);
			}

			if (rows && rows.length > 0) {
				defer.resolve(true);
			} else {
				defer.resolve(false);
			}
		});

		//mysqlConn.end();
	} catch (error) {
		console.log(error);
	}

	return defer.promise;
}