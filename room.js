function Room(name, id, owner) {  
  this.name = name;
  this.id = id;
  this.owner = owner;
  this.people = [];
  this.status = "available";
};

Room.prototype.addPlayer = function(username) {  
	if this.people.count != 4{
		if (this.status === "available") {
		    this.people.push(username);
		  }
	}
  
};

module.exports = Room;  