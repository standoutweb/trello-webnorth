<script>
    import netlifyIdentity from 'netlify-identity-widget';
    import {onMount} from 'svelte';

    netlifyIdentity.init();

    let timelogEntries = [];
    let totalTime = 0;
    let netlify_url = process.env.API_URL

    onMount(async () => {
        await paymoEntries();
    });
	
	async function makeAuthRequest(url) {
		const user = netlifyIdentity.currentUser();
		const jwtToken = user ? await user.jwt() : null;
		
		console.log('Current user:', user);
		console.log('JWT Token:', jwtToken);
		
		const headers = new Headers();
		if (jwtToken) {
			headers.append("Authorization", `Bearer ${jwtToken}`);
		}
		
		// Log headers
		headers.forEach((value, key) => {
			console.log(`Header: ${key} = ${value}`);
		});
		
		// Log URL
		console.log('Request URL:', url);
		
		// Log Request Options
		const requestOptions = {
			headers
		};
		console.log('Request Options:', requestOptions);
		
		const response = await fetch(url, requestOptions);
		
		// Log the full response object
		console.log('Response:', response);
		
		if (!response.ok) {
			console.error('HTTP error! status:', response.status);
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		
		// Log response JSON
		const responseJson = await response.json();
		console.log('Response JSON:', responseJson);
		
		return responseJson;
	}

    async function paymoEntries() {
        const url = `${netlify_url}/paymo/timelogs`;
        try {
            const response = await makeAuthRequest(url);
            let entries = response;
            entries = Object.values(entries) || [];
            entries = entries[0];

            const regex = /https:\/\/trello.com\/c\/([a-zA-Z0-9]+)/;
            entries = entries.filter(entry => regex.test(entry.description));

            entries = entries.map(entry => {
                const match = entry.description.match(regex);
                entry.description = match[1];
                return entry;
            });

            entries.sort((a, b) => a.description.localeCompare(b.description));

            totalTime = entries.reduce((acc, entry) => acc + entry.duration, 0);

            // Categorize entries by Trello card
            timelogEntries = entries.reduce((acc, entry) => {
                if (!acc[entry.description]) {
                    acc[entry.description] = [];
                }
                acc[entry.description].push({
                    duration: entry.duration,
                    startTime: entry.start_time,
                    endTime: entry.end_time,
                    trelloLink: `https://trello.com/c/${entry.description}`,
                    userId: entry.user_id
                });
                return acc;
            }, {});
        } catch (error) {
            timelogEntries = [];
            console.error('Error loading paymo entries:', error);
        }
    }
    function secondsToMinutes(seconds) {
        return Math.floor(seconds / 60);
    }

    function minutesToHours(minutes) {
        return Math.floor(minutes / 60);
    }

    function beautifyDate(dateString) {
        if (!dateString) {
            return 'Bulk added';
        }
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = String(date.getFullYear()).slice(-2);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} - ${hours}:${minutes}`;
    }
</script>

<main>
    {minutesToHours(secondsToMinutes(totalTime))} Hours Total (Time logged with trello link inside)
    {#each Object.entries(timelogEntries) as [cardId, entries]}
        <h2>Card ID: {cardId}</h2>
        {#each entries as entry}
            <div>
                {secondsToMinutes(entry.duration)} -
                <a target="_blank" href="{entry.trelloLink}">{cardId}</a> -
                {beautifyDate(entry.startTime)} - {beautifyDate(entry.endTime)} - {entry.userId}
            </div>
        {/each}
    {/each}
</main>
<style>
    main {
        padding: 10px;
    }
</style>