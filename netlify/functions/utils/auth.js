export function getPaymoAuthHeader() {
	const username = process.env.PAYMO_API_KEY;
	const password = 'random'; // Use a random password as specified
	return 'Basic ' + Buffer.from( username + ':' + password ).toString( 'base64' );
}
