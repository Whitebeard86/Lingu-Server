String.prototype.format = function () {
	var formatted = this;
	for (var i = 0; i < arguments.length; i++) {
		var regexp = new RegExp('\\{' + i + '\\}', 'gi');
		formatted = formatted.replace(regexp, arguments[i]);
	}
	return formatted;
};

var ACTIONS = {
	REGISTER: 1,
	LOGIN: 2,
	MATCHMAKING: 3,
	MATCHMAKING_READY: 4,
	MATCHMAKING_READY_CLIENT_OK: 5,
	BEGIN_GAME: 6,
	REQUEST_RANKING: 7,
	CHAT_MESSAGE: 8,
	PLAYER_ANSWERED_CORRECTLY: 9,
	GAME_FINISH: 10
};

var MATCH_PHASES = {
	ACCEPTING: 1,
	PLAYING: 2
};

var SETTINGS = {
	MYSQL: {
		HOST_NAME: "anlagehub.com",
		DATABASE: "anlageme_lingu",
		USER: "anlageme_lingu",
		PASSWORD: "agrav_lingu22!"
	}
};

// process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT ||
var PORT = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var SOCKET_PORT = 8000;
var IP_ADDRESS = process.env.OPENSHIFT_NODEJS_IP || 'localhost';
var Q = require('q');
var express = require('express');
var mysql = require('mysql');
var app = express();
var http = require('http');
var io = require('socket.io')(http).listen(SOCKET_PORT);

/*app.use(function (req, res, next) {

	// Website you wish to allow to connect
	res.setHeader('Access-Control-Allow-Origin', '*');

	// Request methods you wish to allow
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

	// Request headers you wish to allow
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('Access-Control-Allow-Credentials', false);

	// Pass to next layer of middleware
	next();
});*/

app.set('port', PORT);
app.set('ip', IP_ADDRESS);

http.createServer(app).listen(app.get('port'), app.get('ip'), function () {
	console.log("✔ Express server listening at %s:%d ", app.get('ip'),app.get('port'));
});

var mysqlConn = mysql.createConnection({
	host: SETTINGS.MYSQL.HOST_NAME,
	user: SETTINGS.MYSQL.USER,
	password: SETTINGS.MYSQL.PASSWORD,
	database: SETTINGS.MYSQL.DATABASE
});

var onlinePlayers = {};
var matchmakingPlayers = [];
var matches = [];

io.on('connection', function (socket) {
	console.log("person connected");
	socket.on('message', function (message, fn) {
		console.log("client message: " + message);
		onMessageReceived(message, socket, fn);
	});
	socket.on('disconnect', function () {
		if (onlinePlayers[socket.id]) {
			removePlayerFromMatchmaking(socket.id);
			delete onlinePlayers[socket.id];
		}
	});
});

console.log("ready on " + PORT);

function onMessageReceived(msg, socket, fn) {
	var request = JSON.parse(msg);
	// is this a valid request?
	if (request.action) {
		var res = processRequest(request, socket);

		if (res) {
			res.then(
				function (result) {
					result = JSON.stringify(result);
					console.log("gonna emit: " + result);
					fn(result);
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
		case ACTIONS.MATCHMAKING:
			handleMatchmaking(request, socket);
			break;
		case ACTIONS.MATCHMAKING_READY_CLIENT_OK:
			handleMatchmakingClientOK(request, socket);
			break;
		case ACTIONS.CHAT_MESSAGE:
			handleChatMessage(request, socket);
			break;
		case ACTIONS.PLAYER_ANSWERED_CORRECTLY:
			handlePlayerAnsweredCorrectly(request, socket);
			break;
		case ACTIONS.GAME_FINISH:
			handleGameFinish(request, socket);
			break;
		case ACTIONS.REQUEST_RANKING:
			return handleRanking();
			break;
	}
}

function handleGameFinish(request, socket) {
	var match = getMatchById(request.matchId);
	if (match) {
		match.finishedBy.push(socket.id);
		console.log("Game finished by: " + socket.id);
		if (match.finishedBy.length >= match.players.length) {
			var pointsInfo = [];
			//
			for(var i = 0; i < match.players.length; i++) {
				var arr = {};
				arr.playerInfo = match.players[i];
				arr.points = match.points[match.players[i].socketId];
				pointsInfo.push(arr);
			}

			// check points and set/update player experience:
			var highestPoint = -1;
			var winnerId = -1;
			for(var i = 0; i < match.players.length; i++) {
				if(match.points[match.players[i].socketId] > highestPoint) {
					highestPoint = match.points[match.players[i].socketId];
					winnerId = match.players[i].socketId;
				} else if(match.points[match.players[i].socketId] == highestPoint) {
					// draw..
					winnerId = -1;
					break;
				}
			}

			if(winnerId != -1) {
				// update experience:
				try {
					var sql = "UPDATE player SET player.experience = player.experience+1 WHERE player.id_player = " + onlinePlayers[winnerId].info.id;
					console.log(sql);
					mysqlConn.query(sql);
				} catch (error) {
					console.log(error);
				}
			}

			// all players finished, let's present some results:
			var msg = {
				action: ACTIONS.GAME_FINISH,
				matchId: match.id,
				pointsInfo: pointsInfo
			};

			for (var i = 0; i < match.acceptedBy.length; i++) {
				sendMessage(onlinePlayers[match.acceptedBy[i]].socket, msg);
			}

			removeMatch(match.id);
		}
	}
}

function handlePlayerAnsweredCorrectly(request, socket) {
	var match = getMatchById(request.matchId);
	if (match) {
		match.points[socket.id]+=1;

		var msg = {
			action: ACTIONS.PLAYER_ANSWERED_CORRECTLY,
			playerInfo: onlinePlayers[socket.id].info,
			matchId: match.id
		};

		for (var i = 0; i < match.acceptedBy.length; i++) {
			// don't send the message to the player who sent it
			if (match.acceptedBy[i] != socket.id) {
				sendMessage(onlinePlayers[match.acceptedBy[i]].socket, msg);
			}
		}
	}
}

function handleChatMessage(request, socket) {
	var match = getMatchById(request.matchId);
	if (match) {
		var msg = {
			action: ACTIONS.CHAT_MESSAGE,
			matchId: match.id,
			chatMessageId: request.chatMessageId
		};

		for (var i = 0; i < match.acceptedBy.length; i++) {
			// don't send the message to the player who sent it
			if (match.acceptedBy[i] != socket.id) {
				sendMessage(onlinePlayers[match.acceptedBy[i]].socket, msg);
			}
		}
	}
}

function sortLevelPredicate(a, b) {
	return a.experience - b.experience;
}

function transformComplexArray(array, idToDiscard) {
	var transformed = [];
	for (var key in array) {
		if (array[key].socket.id != idToDiscard) {
			transformed.push(array[key]);
		}
	}
	return transformed;
}

function sortPlayersByLevel(playerList, idToDiscard) {
	var sortedArray =  playerList;//transformComplexArray(playerList, idToDiscard);
	return sortedArray.sort(sortLevelPredicate);
}

function removePlayerFromMatchmaking(socketID) {
	for (var i = matchmakingPlayers.length - 1; i >= 0; i--) {
		if (matchmakingPlayers[i].socket.id == socketID) {
			matchmakingPlayers.splice(i, 1);
			break;
		}
	}
}

function removeMatch(id) {
	console.log("trying to remove match with id: " + id + " (" + matches.length + " matches running)");
	for(var i = matches.length-1; i >= 0; i--) {
		if (matches[i].id == id) {
			matches.splice(i, 1);
			break;
		}
	}
	console.log(matches.length + " matches running");
}

function getMatchById(id) {
	for (var k in matches) {
		if (matches[k].id == id) {
			return matches[k];
		}
	}
	return null;
}

function handleMatchmakingClientOK(request, socket) {
	var match = getMatchById(request.matchId);
	if (match) {
		match.acceptedBy.push(socket.id);

		if (match.acceptedBy.length >= match.players.length) {
			// both players accepted the match, let's begin!
			var msg = {
				action: ACTIONS.BEGIN_GAME,
				matchId: match.id,
				players: match.players
			};

			for (var k in match.acceptedBy) {
				sendMessage(onlinePlayers[match.acceptedBy[k]].socket, msg);
			}

			match.phase = MATCH_PHASES.PLAYING;
		}
	}
}

function handleMatchmaking(request, socket) {
	var action = function (params) {
		var sortedPlayers = sortPlayersByLevel(matchmakingPlayers, socket.id);

		if (sortedPlayers.length > 0) {
			var peer = sortedPlayers[0]; // TODO: match similar player levels

			// remove the queued player from the matchmaking list:
			removePlayerFromMatchmaking(peer.socket.id);

			var match = {
				id: Math.random().toString(36).substring(8),
				phase: MATCH_PHASES.ACCEPTING,
				acceptedBy: [],
				finishedBy: [],
				points: {},
				players: [
					onlinePlayers[socket.id].info,
					peer.info
				]
			};

			// send a message to both players:
			var msg = {};
			msg.action = ACTIONS.MATCHMAKING_READY;
			msg.matchId = match.id;
			/*msg.gameLevel = 0; // TODO: calculate level based on players experience
			 msg.players = [
			 onlinePlayers[socket.id].info,
			 peer.info
			 ];*/

			for (var k = 0; k < match.players.length; k++) {
				match.points[match.players[k].socketId] = 0;
			}

			sendMessage(socket, msg);
			sendMessage(peer.socket, msg);

			matches.push(match);

		} else {
			// no player available, set the player in a matchmaking list..
			addPlayerToMatchmaking(onlinePlayers[socket.id]);
		}
	};

	action({request: request, socket: socket});
}

function addPlayerToMatchmaking(player) {
	for (var k in matchmakingPlayers) {
		if(matchmakingPlayers[k]) {
			// player already on matchmaking list?
			if (matchmakingPlayers[k].socket.id == player.socket.id) {
				return;
			}
		}
	}
	matchmakingPlayers.push(player);
}

function handleLogin(request, socket) {
	var defer = Q.defer();

	// handle login here..
	try {
		//mysqlConn.connect();

		var sql = "SELECT p.id_player as id, p.username as name, p.email, p.avatar_url as avatar, p.experience FROM player p WHERE p.username = '" + request.username +
			"' AND p.password = MD5('" + request.password + "')";

		mysqlConn.query(sql, function (err, rows, fields) {
			if (err) {
				console.log(err);
				defer.reject(err);
			}

			if (rows && rows.length > 0) {
				// store the available player:
				if (!onlinePlayers[socket.id]) {
					var playerdata = {
						info: rows[0],
						socket: socket
					};

					playerdata.info.socketId = socket.id;

					onlinePlayers[socket.id] = playerdata;
				}

				//console.log("c: " + Object.keys(onlinePlayers).length);

				defer.resolve(rows[0]);
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

function handleRanking() {
	var defer = Q.defer();

	try {
		var sql = "SELECT * FROM player ORDER BY experience DESC"

		mysqlConn.query(sql, function (err, rows) {
			if (err) {
				console.log(err);
				defer.reject(err);
			}
			if (rows && rows.length > 0) {
				defer.resolve(rows);
			} else {
				defer.resolve(false);
			}
		});

	} catch (error) {
		console.log(error);
	}

	return defer.promise;
}

function sendMessage(socket, obj) {
	socket.send(JSON.stringify(obj));
}
