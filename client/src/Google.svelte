<script>
    import { onMount } from 'svelte';
    import { google } from 'googleapis';

    let authorizeButtonVisibility = 'hidden';
    let signoutButtonVisibility = 'hidden';
    let authorizeButtonText = 'Authorize';

    const API_KEY = process.env.GOOGLE_API_KEY;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';

    let authInstance;
    let gapiInited = false;

    onMount(async () => {
        try {
            const auth = new google.auth.OAuth2(CLIENT_ID, API_KEY, 'http://localhost:8888');
            google.options({ auth });

            authInstance = await google.auth.getClient({
                scopes: SCOPES
            });

            gapiInited = true;
            maybeEnableButtons();
        } catch (error) {
            console.error(error);
        }
    });

    function maybeEnableButtons() {
        if (gapiInited) {
            authorizeButtonVisibility = 'visible';
        }
    }

    async function handleAuthClick() {
        if (authInstance) {
            try {
                await authInstance.authorize();
                signoutButtonVisibility = 'visible';
                authorizeButtonText = 'Refresh';
            } catch (error) {
                console.error(error);
            }
        }
    }

    async function handleSignoutClick() {
        if (authInstance) {
            try {
                await authInstance.revokeCredentials();
                authorizeButtonText = 'Authorize';
                signoutButtonVisibility = 'hidden';
            } catch (error) {
                console.error(error);
            }
        }
    }
</script>

<button id="authorize_button" on:click={handleAuthClick} style="visibility: {authorizeButtonVisibility};">{authorizeButtonText}</button>
<button id="signout_button" on:click={handleSignoutClick} style="visibility: {signoutButtonVisibility};">Sign Out</button>