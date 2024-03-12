<script>
    import netlifyIdentity from 'netlify-identity-widget';
    import {onMount} from 'svelte';

    netlifyIdentity.init();

    let timelogEntries = [];
    let totalTime = 0;
    let netlify_url = process.env.API_URL
    let daily_cards_arr = [];
    let gapiLoaded = false;
    const CLIENT_ID = '316705895462-ko4p8onvqpltr91eglh8jidvi68nq99u.apps.googleusercontent.com';
    const API_KEY = 'AIzaSyAh6IR0OjlFYb82HguESGZu9TgIrVKSkM4';

    onMount(async () => {
        await loadCards();
        await paymoEntries();
        await googleConnect();
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
        const url = `${netlify_url}/timelogs`;
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
                if (daily_cards_arr.some(card => card === entry.description)) {
                    return entry;
                }
            }).filter(entry => entry !== undefined);

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

    async function loadCards() {
        const url = `${netlify_url}/boards/61483390071f5084f7480f0a/cards`;
        try {
            const daily_cards = await makeAuthRequest(url);
            daily_cards_arr = daily_cards.map(card => card.shortLink);
            return daily_cards_arr;
        } catch (error) {
            console.error('Error loading cards:', error);
        }
    }

    async function googleConnect() {
        const timeDuration = minutesToHours(secondsToMinutes(totalTime));
        const spreadsheetId = '1K_vXF_TzSE_QhRGw9EcGf7yp6xRDYdIqfPaANUga9yg';
        const values = [
            ["Week #", timeDuration],
        ];
       updateValues(spreadsheetId, 'USER_ENTERED', values)
    }

    function getExistingDataRange(spreadsheetId) {
        return gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `A1:ZZZ`
        }).then((response) => {
            var values = response.result.values;
            if (!values || !values.length) {
                return null; // No data found
            }
            // Find the range of cells with data
            var startRow = 1;
            var startColumn = 1;
            var endRow = values.length;
            var endColumn = values[0].length;
            // Trim empty rows at the end
            while (endRow > startRow && !values[endRow - 1].some(cell => cell.trim() !== '')) {
                endRow--;
            }
            // Trim empty columns at the end
            while (endColumn > startColumn && !values.some(row => row[endColumn - 1].trim() !== '')) {
                endColumn--;
            }
            // Calculate the range
            var startColumnLetter = String.fromCharCode(65 + startColumn - 1); // A=65 in ASCII
            var endColumnLetter = String.fromCharCode(65 + endColumn - 1);
            var range = `${startColumnLetter}${startRow}:${endColumnLetter}${endRow}`;
            return range;
        });
    }

    async function updateValues(spreadsheetId, valueInputOption, values) {
        // Get existing data range
        let existingDataRange = await getExistingDataRange(spreadsheetId);
        if (!existingDataRange) {
            console.error('Failed to get existing data range.');
            return;
        }

        // Calculate new range
        var numRows = values.length;
        var startRow = parseInt(existingDataRange.split(':')[1].match(/\d+/)[0]);
        var startDataColumn = existingDataRange.split(':')[0].match(/[A-Z]+/)[0];
        var endDataColumn = existingDataRange.split(':')[1].match(/[A-Z]+/)[0];
        var newRange = `${startDataColumn}${startRow + 1}:${endDataColumn}${startRow + numRows}`;
        // Update values
       /* var body = {
            values: values
        };
        gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: newRange,
            valueInputOption: valueInputOption,
            resource: body
        }).then((response) => {
            var result = response.result;
            console.log(`${result.updatedCells} cells updated.`);
        });*/
    }

</script>

<main>
    {minutesToHours(secondsToMinutes(totalTime))} Hours Total (Time logged with trello link inside)
    {#each Object.entries(timelogEntries) as [cardId, entries]}
        {#if daily_cards_arr.some(card => card === cardId)}
            <h2>Card ID: {cardId}</h2>
            {#each entries as entry}
                <div>
                    {secondsToMinutes(entry.duration)} -
                    <a target="_blank" href="{entry.trelloLink}">{cardId}</a> -
                    {beautifyDate(entry.startTime)} - {beautifyDate(entry.endTime)}
                </div>
            {/each}
        {/if}
    {/each}
</main>
<style>
    main {
        padding: 10px;
    }
</style>