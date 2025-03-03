import { readFileSync } from 'fs'

const data = readFileSync('./config.json', 'utf-8')
const config = JSON.parse(data)
let token = ""

async function getToken(clientId, clientSecret) {
    const url = "https://accounts.spotify.com/api/token";
    
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: config.client_id,
            client_secret: config.client_secret
        })
    });

    if (!response.ok) {
        throw new Error(`Error fetching token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function fetchWebApi(endpoint, method, body) {
	const res = await fetch(`https://api.spotify.com/${endpoint}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
		method,
		body:JSON.stringify(body)
	})
	return await res.json()
}

async function getBasePlaylistNames(){
	return await Promise.all(config.base_playlist_ids.map(async (id) => {
		let res = await fetchWebApi(`v1/playlists/${id}`, 'GET')
		return {id: id, name: res.name}
	}))
}

async function getPlaylistItems(playlist_id){
	return (await fetchWebApi(
		`v1/playlists/${playlist_id}/tracks`, 'GET'
	)).items
}

token = await getToken()
console.log(await getBasePlaylistNames())
