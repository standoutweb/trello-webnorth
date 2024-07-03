const requireAuth = (req, res, next) => {
	console.log('Request received');
	console.log('Request Headers:', req.headers);
	console.log('Query Params:', req.query);

	if (req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE) {
		console.log('Authorized via secret');
		return next();
	}

	if (process.env.NODE_ENV === 'development') {
		console.log('Authorized in development mode');
		return next();
	}

	const userEmail = req.headers['x-user-email'];
	const userId = req.headers['x-user-id'];

	if (!userEmail || !userId) {
		console.log('Unauthorized: No user information');
		return res.status(401).send('Unauthorized');
	}

	const allowedUsers = JSON.parse(process.env.ALLOWED_USERS || '[]');
	const allowedUserIds = JSON.parse(process.env.ALLOWED_USER_IDS || '[]');

	// Check if the userEmail is in the allowedUsers list
	if (!allowedUsers.includes(userEmail)) {
		console.log('Unauthorized: User email not in allowed list');
		return res.status(401).send('Unauthorized');
	}

	// Check if the userId is in the allowedUserIds list
	if (!allowedUserIds.includes(userId)) {
		console.log('Unauthorized: User ID not in allowed list');
		return res.status(401).send('Unauthorized');
	}

	// check combination first userEmail with first userId matches
	if (allowedUsers.indexOf(userEmail) !== allowedUserIds.indexOf(userId)) {
		console.log('Unauthorized: User email and ID do not match');
		return res.status(401).send('Unauthorized');
	}

	console.log('Authorized via user information');
	req.user = { email: userEmail, id: userId };
	next();
};

export default requireAuth;
