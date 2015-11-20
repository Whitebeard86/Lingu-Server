var ACTIONS = {
    REGISTER: 1,
    LOGIN: 2,

};

var DATABASE = mysql.createConnection({
        HOST_NAME: "anlagehub.com",
        DATABASE: "anlageme_lingu",
        USER: "anlageme_lingu",
        PASSWORD: "agrav_lingu22!"
    });

DATABASE.connect(function(err) {
    if (err) {
    console.error('error connecting: ' + err.stack);
    return;
}});

// Let’s make node/socketio listen on port 8080
var io = require('socket.io').listen(8080);
 
io.sockets.on('connection', function(socket){
    socket.auth = false;
    //temp delete socket from namespace connected map
    //delete socketio.sockets.connected[socket.id];
    socket.on('disconnect', function() {
        io.sockets.emit('users disconnected', socketCount);
        onMessageReceived(data, socket); 
    })
 
    socket.on('sign_up', function(data){
        io.sockets.emit('sign_up', data);
        onMessageReceived(data, socket); 
        
    })

    socket.on('authenticate', function(data){ 
        socket.auth = false;
        onMessageReceived(data, socket) 
    })
 
    //If the socket didn't authenticate, disconnect it
    setTimeout(function(){
        //If the socket didn't authenticate, disconnect it
        if (!socket.auth) {
          console.log("Disconnecting socket ", socket.id);
          socket.disconnect('unauthorized');
        }
    }, 2000);
});


function onMessageReceived (msg, socket) {
    var request = JSON.parse(msg);
    if(request.action) {
        processRequest(request, socket);
    }
}

function processRequest (request, socket) {
    switch(request.action) {
        case 1:
            handleSignup(request, socket);
            break;
        case 2:
            handleLogin(request, socket);
            break;
    }
}

function handleLogin(request, socket) {
    // handle login here..
    // tratar db injection
    db.query('SELECT * FROM players where username = ? and password = ?', request.username, request.password)
        .on('result', function(data){
            socket.auth = true;
        })
        .on('error', function(){
            // Only emit notes after query has been completed
            socket.emit('erros', data)
        })
    
}

function handleSignup(request, socket) {
    // handle login here..
    db.query('INSERT INTO player (username, password) VALUES (?,?)', request.username, request.password)
        .on('result', function(data){

            socket.emit('sucesso', data)
        })
        .on('error', function(){
            socket.emit('erros', data)
        })
    
}

function handleLogout(request, socket) {
    // handle login here..
}


function handlegamerequest(request, socket) {

}







