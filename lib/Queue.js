function Queue() {
	this.first = null;
	this.last = null;
}

Queue.prototype.append = function (obj) {
	if (this.last) {
		this.last.next = obj;
		this.last = obj;
	} else {
		this.first = this.last = obj;
	}
};


Queue.prototype.getOne = function () {
	var result = this.first;

	if (result) {
		this.first = result.next;
		result.next = null;

		if (result === this.last) {
			this.last = null;
		}
	}

	return result;
};


Queue.prototype.isEmpty = function () {
	return this.last === null;
};

module.exports = Queue;
