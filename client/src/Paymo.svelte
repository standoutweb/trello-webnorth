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
        const headers = new Headers();
        if (jwtToken) {
            headers.append("Authorization", `Bearer ${jwtToken}`);
        }
        const response = await fetch(url, {headers});
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    async function paymoEntries() {
        const url = `${netlify_url}/paymo/timelogs`;
        try {
            const response = await makeAuthRequest(url);
            timelogEntries = response;
            timelogEntries = Object.values(timelogEntries) || [];
            timelogEntries = timelogEntries[0];

            const regex = /https:\/\/trello.com\/c\/([a-zA-Z0-9]+)/;
            timelogEntries = timelogEntries.filter(entry => regex.test(entry.description));

            timelogEntries = timelogEntries.map(entry => {
                const match = entry.description.match(regex);
                entry.description = match[1];
                return entry;
            });

            timelogEntries.sort((a, b) => a.description.localeCompare(b.description));

            totalTime = timelogEntries.reduce((acc, entry) => acc + entry.duration, 0);

            console.log(response);
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
    {#each timelogEntries as timelogEntry}
        <div>
            {secondsToMinutes(timelogEntry.duration)} -
            <a target="_blank" href="https://trello.com/c/{timelogEntry.description}">{timelogEntry.description.replace(/(<([^>]+)>)/gi, "")}</a> -
            {beautifyDate(timelogEntry.start_time)} - {beautifyDate(timelogEntry.end_time)}
        </div>
    {/each}
</main>

<style>
    main {
        padding: 10px;
    }
</style>