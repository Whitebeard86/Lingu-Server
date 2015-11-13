var io = require('socket.io')(8080);

io.on('connection', function (socket) {
  socket.on('message', onMessageReceived);
  socket.on('disconnect', function () { });
});

function onMessageReceived(msg) {
    var decoded = JSON.parse(msg);
    console.log(decoded.action);

    for(var i in decoded.params) {
        console.log(i + ": " + decoded.params[i]);
    }
}
