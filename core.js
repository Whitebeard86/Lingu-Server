var ACTIONS = {
    REGISTER: 1,
    LOGIN: 2
};

var DATABASE = {
    MYSQL: {
        HOST_NAME: "anlagehub.com",
        DATABASE: "anlageme_lingu",
        USER: "anlageme_lingu",
        PASSWORD: "agrav_lingu22!"
    }
};

var io = require('socket.io')(8080);
io.on('connection', function (socket) {
    socket.on('message', function(message) { onMessageReceived(message, socket); });
    socket.on('disconnect', function () {});
});

function onMessageReceived (msg, socket) {
    var request = JSON.parse(msg);
    if(request.action) {
        processRequest(request, socket);
    }
}

function processRequest (request, socket) {
    switch(request.action) {
        case ACTIONS.LOGIN:
            handleLogin(request, socket);
            break;
    }
}

function handleLogin(request, socket) {
    // handle login here..
}