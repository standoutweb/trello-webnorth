<script>
	import netlifyIdentity from 'netlify-identity-widget';
	import { onMount } from 'svelte';
	
	// Initialize Netlify Identity
	netlifyIdentity.init();
	
	let boards = [];
	let lastRefreshed = '';
	let selectedBoard = null;
	let selectedCard = null;
	let selectedTimelog = false;
	let timelogEntries = [];
	let totalLoggedTime = 0;
	let loadingState = false;
	let cards = [];
	let actions = [];
	let netlify_url = process.env.API_URL;
	let error = false;
	let pagination = 1;
	let timelogUrl = '';  // This will hold the current value of the timelog input
	let showTimelogButton = true;  // This controls the visibility of the timelog button
	$: showTimelogButton = timelogUrl.trim() !== '';
	
	onMount( async () => {
		await loadBoards();
	} );
	
	function paginationPlus() {
		handleTimeLogSubmit();
	}
	
	async function makeAuthRequest( url ) {
		const user = netlifyIdentity.currentUser();
		const jwtToken = user ? await user.jwt() : null;
		
		const headers = new Headers();
		if ( jwtToken ) {
			headers.append( "Authorization", `Bearer ${ jwtToken }` );
		}
		
		const response = await fetch( url, { headers } );
		if ( ! response.ok ) {
			throw new Error( `HTTP error! status: ${ response.status }` );
		}
		return response.json();
	}
	
	async function loadBoards() {
		const url = `${ netlify_url }/boards`;
		try {
			// check if boards are in local storage
			const localBoards = localStorage.getItem( 'boards' );
			if ( localBoards ) {
				boards = JSON.parse( localBoards );
				lastRefreshed = localStorage.getItem( 'lastRefreshed' );
			} else {
				boards = await makeAuthRequest( url );
				boards.sort( ( a, b ) => new Date( b.dateLastActivity ) - new Date( a.dateLastActivity ) );
				
				localStorage.setItem( 'boards', JSON.stringify( boards ) );
				lastRefreshed = new Date().toISOString();
				localStorage.setItem( 'lastRefreshed', lastRefreshed );
			}
		} catch ( error ) {
			console.error( 'Error loading boards:', error );
		}
	}
	
	async function loadCards( boardId ) {
		const url = `${ netlify_url }/boards/${ boardId }/cards`;
		try {
			cards = await makeAuthRequest( url );
			cards.sort( ( a, b ) => new Date( b.dateLastActivity ) - new Date( a.dateLastActivity ) );
		} catch ( error ) {
			console.error( 'Error loading cards:', error );
		}
	}
	
	async function loadCardActions( cardId ) {
		const url = `${ netlify_url }/cards/${ cardId }/actions`;
		try {
			actions = await makeAuthRequest( url );
			actions.sort( ( a, b ) => new Date( b.date ) - new Date( a.date ) );
		} catch ( error ) {
			console.error( 'Error loading card actions:', error );
		}
	}
	
	async function refreshBoards() {
		const url = `${ netlify_url }/boards`;
		try {
			boards = await makeAuthRequest( url );
			boards.sort( ( a, b ) => new Date( b.dateLastActivity ) - new Date( a.dateLastActivity ) );
			
			localStorage.setItem( 'boards', JSON.stringify( boards ) );
			lastRefreshed = new Date().toISOString();
			localStorage.setItem( 'lastRefreshed', lastRefreshed );
		} catch ( error ) {
			console.error( 'Error refreshing boards:', error );
		}
	}
	
	function handleBoardClick( board ) {
		selectedBoard = board;
		loadCards( board.id );
	}
	
	let lastShortLink = null;  // Variable to store the last processed shortLink
	
	async function handleTimeLogSubmit() {
		const urlRaw = document.getElementById( 'timelog-url' ).value;
		
		if ( ! urlRaw ) {
			alert( 'Please enter a Trello URL' );
			return;
		}
		
		// Regular expression to extract the Trello card short link
		const match = urlRaw.match( /https:\/\/trello\.com\/c\/([a-zA-Z0-9]+)/ );
		
		if ( ! match ) {
			alert( 'Please enter a valid Trello URL' );
			return;
		}
		
		const shortLink = match[ 1 ]; // Capture the short link part of the URL
		
		// Check if shortLink has changed since the last submission
		if ( shortLink !== lastShortLink ) {
			timelogEntries = [];  // Clear previous timelog entries
			pagination = 1;       // Reset pagination
			lastShortLink = shortLink; // Update lastShortLink to the new one
		}
		
		const url = `${ netlify_url }/cards/${ shortLink }/${ pagination }/timelogs`;
		
		showTimelogButton = false;
		
		try {
			error = false;
			loadingState = true;
			
			const newTimelogEntries = await makeAuthRequest( url );
			newTimelogEntries.sort( ( a, b ) => new Date( b.date ) - new Date( a.date ) );
			
			// Append new entries to existing ones
			timelogEntries = [ ...timelogEntries, ...newTimelogEntries ];
			timelogEntries.sort((a, b) => new Date(b.date || b.start_time) - new Date(a.date || a.start_time));
			
			totalLoggedTime = timelogEntries.reduce( ( acc, entry ) => acc + entry.duration, 0 );
			
			loadingState = false;
			pagination++;  // Increment pagination to load next set of data next time
		} catch ( error ) {
			console.error( 'Error loading timelog:', error );
			loadingState = false;
			error = true;
			showTimelogButton = true;
		}
	}
	
	async function fetchAndDisplayTaskName(taskId) {
		const taskUrl = `${netlify_url}/paymo/task/${taskId}`;
		const taskData = await makeAuthRequest(taskUrl);
		
		// Find the task ID link and replace its text with the task name
		const taskLink = document.getElementById(`task-${taskId}`);
		taskLink.textContent = taskData.name;
		
		// Remove the href attribute to make it no longer a link
		taskLink.removeAttribute('href');
		// Optionally, you can also remove the click event listener
		taskLink.onclick = null;
	}
	function handleTimelogCheck() {
		selectedTimelog = ! selectedTimelog;
	}
	
	function handleCardClick( card ) {
		selectedCard = card;
		loadCardActions( card.id );
	}
	
	function closeDrawer() {
		selectedBoard = null;
		cards = [];
	}
	
	function closeCardDrawer() {
		selectedCard = null;
	}
	
	function convertDate( date ) {
		const dateObj = new Date( date );
		const day = dateObj.getDate();
		const month = dateObj.getMonth() + 1;
		const year = dateObj.getFullYear();
		const hours = dateObj.getHours();
		const minutes = dateObj.getMinutes();
		const seconds = dateObj.getSeconds();
		
		const twoDigitDay = day < 10 ? `0${ day }` : day;
		const twoDigitMonth = month < 10 ? `0${ month }` : month;
		const twoDigitHours = hours < 10 ? `0${ hours }` : hours;
		const twoDigitMinutes = minutes < 10 ? `0${ minutes }` : minutes;
		const twoDigitSeconds = seconds < 10 ? `0${ seconds }` : seconds;
		return `${ twoDigitDay }/${ twoDigitMonth }/${ year } ${ twoDigitHours }:${ twoDigitMinutes }:${ twoDigitSeconds }`;
	}
	
	function secondsToMinutes( seconds ) {
		return seconds / 60;
	}
	
	function minutesToHours( minutes ) {
		return minutes / 60;
	}
	
	function beautifyDate(entry) {
		// If entry.date is empty, then return .start_time
		if (!entry.date) {
			// Extract the date part from the start_time
			const dateFromStartTime = new Date(entry.start_time).toISOString().split('T')[0];
			return formatDate(dateFromStartTime);
		} else {
			return formatDate(entry.date);
		}
	}
	
	function formatDate(dateString) {
		// Split the date string to extract the year, month, and day
		const [year, month, day] = dateString.split('-');
		
		// Create a new Date object from the extracted components
		const date = new Date(year, month - 1, day);
		
		// Format the date in the European format (DD.MM.YYYY)
		const formattedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
		
		return formattedDate;
	}
</script>

<div class="d-flex gap-20 justify-between p-10 align-center">
	{#if lastRefreshed}
		<span>Last refreshed: {convertDate( lastRefreshed )}</span>
	{/if}
	<div class="pt-10 pb-10 d-flex gap-20">
		<svg on:click={refreshBoards} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30px" height="30px"
			 class="pointer">
			<path
				d="M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"></path>
		</svg>
		
		<svg on:click={() => netlifyIdentity.open()} xmlns="http://www.w3.org/2000/svg" class="svg-icon pointer"
			 style="width: 30px; height: 30px;vertical-align: middle;fill: currentColor;overflow: hidden;"
			 viewBox="0 0 1024 1024" version="1.1">
			<path
				d="M843.282963 870.115556c-8.438519-140.515556-104.296296-257.422222-233.908148-297.14963C687.881481 536.272593 742.4 456.533333 742.4 364.088889c0-127.241481-103.158519-230.4-230.4-230.4S281.6 236.847407 281.6 364.088889c0 92.444444 54.518519 172.183704 133.12 208.877037-129.611852 39.727407-225.46963 156.634074-233.908148 297.14963-0.663704 10.903704 7.964444 20.195556 18.962963 20.195556l0 0c9.955556 0 18.299259-7.774815 18.962963-17.73037C227.745185 718.506667 355.65037 596.385185 512 596.385185s284.254815 122.121481 293.357037 276.195556c0.568889 9.955556 8.912593 17.73037 18.962963 17.73037C835.318519 890.311111 843.946667 881.019259 843.282963 870.115556zM319.525926 364.088889c0-106.287407 86.186667-192.474074 192.474074-192.474074s192.474074 86.186667 192.474074 192.474074c0 106.287407-86.186667 192.474074-192.474074 192.474074S319.525926 470.376296 319.525926 364.088889z"/>
		</svg>
		
		<a on:click={handleTimelogCheck} class="btn btn-primary">Timelog</a>
	</div>
</div>

<div class="d-flex gap-20 justify-between p-10 bg-black text-white">
	<div>Board Name</div>
	<div>Latest Activity</div>
</div>

{#each boards as board}
	<div class="d-flex gap-20 justify-between bb-1 p-10">
		<a on:click={() => handleBoardClick(board)} target="_blank">{board.name}</a>
		<div class="text-right d-flex shrink-0">{convertDate( board.dateLastActivity )}</div>
	</div>
{/each}

{#if selectedBoard}
	<div class="drawer cards">
		<a class="btn btn-primary p-fixed r-5 t-5 text-small" on:click={closeDrawer}>Close</a>
		<h3>{selectedBoard.name} Cards</h3>
		{#each cards as card}
			<div class="pt-10 pb-10 bb-1 d-flex direction-column">
				<a class="word-break" on:click={handleCardClick(card)} target="_blank">{card.name}</a>
				<span class="text-small">Latest Activity: {convertDate( card.dateLastActivity )}</span>
			</div>
		{/each}
	</div>
{/if}

{#if selectedCard}
	<div class="drawer actions">
		<a class="btn btn-primary p-fixed r-5 t-5 text-small" on:click={closeCardDrawer}>← Back</a>
		
		<a class="word-break" href="{selectedCard.shortUrl}" target="_blank"><h3>{selectedCard.name}</h3></a>
		<span class="card-description">{selectedCard.desc}</span>
		<div class="mt-20">
			{#if actions && actions.length > 0}
				{#each actions as action}
					<div class="pt-10 pb-10 bb-1 d-flex direction-column">
						<span class="text-small mb-10">{action.type}</span>
						{#if action.data.listAfter && action.data.listAfter.name}
							<span class="text-small mb-10">Moved to: {action.data.listAfter.name}</span>
						{/if}
						{#if action.data.text && action.data.text.length > 0}
							<span class="text-small mb-10">{action.data.text}</span>
						{/if}
						<span class="text-small">{action.memberCreator.fullName} on {convertDate( action.date )}</span>
					</div>
				{/each}
			{:else}
				<div class="pt-10 pb-10 bb-1 d-flex direction-column">
					<span>No actions found, this might be a new card</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if selectedTimelog}
	<div class="drawer timelog">
		<a class="btn btn-primary p-fixed r-5 t-5 text-small" on:click={handleTimelogCheck}>Close</a>
		<h3>Timelog</h3>
		<div class="pt-10 pb-10 bb-1 d-flex direction-column">
			<span class="text-small mb-10">Use this tool to check the logged time based on cards. Simply paste the card url and check the timelog</span>
		</div>
		
		<div class="pt-10 pb-10 bb-1 d-flex direction-column">
			<input id="timelog-url" type="text" bind:value={timelogUrl} placeholder="Paste the card URL here"/>
			{#if showTimelogButton}
				<button class="btn btn-primary" on:click={handleTimeLogSubmit} disabled="{loadingState}">Check Timelog</button>
			{/if}
		</div>
		
		{#each timelogEntries as timelog}
			<div class="pt-10 pb-10 bb-1 d-flex direction-column">
				<span class="text-small mb-10">Logged time: {secondsToMinutes( timelog.duration )}</span>
				<span class="text-small mb-10">Logged by: {timelog.user_name}</span>
				<span class="text-small mb-10">Logged on: {beautifyDate( timelog )} </span>
				<span class="text-small">Paymo Task: <a href="#" id="task-{timelog.task_id}" data-id="{timelog.task_id}" on:click|preventDefault={() => fetchAndDisplayTaskName(timelog.task_id)}>Load name</a> or <a target="_blank" href="https://app.paymoapp.com/#/Paymo.Timesheets/task/{timelog.task_id}">Open in Paymo</a></span>
			</div>
		{/each}
		
		{#if loadingState}
			<div class="pt-10 pb-10 bb-1 d-flex direction-column">
				<span class="text-small">Loading...</span>
			</div>
		{/if}
		
		{#if error}
			<div class="pt-10 pb-10 bb-1 d-flex direction-column">
				<span class="text-small">Error loading timelog, please try again</span>
			</div>
		{/if}
		
		{#if timelogEntries.length > 0}
			{#if totalLoggedTime > 0}
				<span class="pt-10 pb-10 text-small">{minutesToHours( secondsToMinutes( totalLoggedTime ) )} hours logged in total. Load more to see if there are more entries. Each page contains former 30 days of data. For example page 2 will show data from 60 days ago to 30 days ago.
				</span>
			{/if}
			
			<div class="pt-10 pb-10 bb-1 d-flex direction-column">
				<button class="btn btn-primary" on:click={paginationPlus}>Load page { pagination }</button>
			</div>
		{/if}
	
	
	</div>
{/if}

<style>
	body {
		padding: unset !important;
	}
	
	.d-flex {
		display: flex;
	}
	
	.gap-20 {
		gap: 20px;
	}
	
	.justify-between {
		justify-content: space-between;
	}
	
	.mb-10 {
		margin-bottom: 10px;
	}
	
	.bb-1 {
		border-bottom: 1px solid #ccc;
	}
	
	.p-10 {
		padding: 10px;
	}
	
	.bg-black {
		background-color: #000;
	}
	
	.text-white {
		color: #fff;
	}
	
	p-0 {
		padding: 0;
	}
	
	.btn {
		padding: 10px;
		border-radius: 5px;
		cursor: pointer;
	}
	
	.btn-primary {
		background-color: #0079bf;
		color: #fff;
	}
	
	.align-center {
		align-items: center;
	}
	
	.drawer {
		position: fixed;
		right: 0;
		top: 0;
		width: auto;
		max-width: 700px;
		height: 100%;
		background-color: white;
		box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2);
		padding: 10px;
		overflow-y: auto;
	}
	
	.text-small {
		font-size: 12px;
	}
	
	.direction-column {
		flex-direction: column;
	}
	
	.p-absolute {
		position: absolute;
	}
	
	.r-10 {
		right: 10px;
	}
	
	.r-5 {
		right: 5px;
	}
	
	.t-5 {
		top: 5px;
	}
	
	.p-fixed {
		position: fixed;
	}
	
	.word-break {
		word-break: break-all;
	}
	
	.text-right {
		text-align: right;
	}
	
	.shrink-0 {
		flex-shrink: 0;
	}
	
	.pt-10 {
		padding-top: 10px;
	}
	
	.pb-10 {
		padding-bottom: 10px;
	}
	
	.mt-20 {
		margin-top: 20px;
	}
	
	span {
		word-break: break-word;
	}
	
	.pointer {
		cursor: pointer;
	}

</style>
