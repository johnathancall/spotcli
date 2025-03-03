import { readFileSync } from 'fs'

const data = readFileSync('./config.json', 'utf-8')
const config = JSON.parse(data)
let token = ""

// Get authtoken for use in all other operations
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

// Catch-all fetch web API function
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


// Fetching playlist info
async function getPlaylistNames(playlist_ids){
	const playlists = await Promise.all(playlist_ids.map(async (id) => {
		let res = await fetchWebApi(`v1/playlists/${id}`, 'GET')
		console.log(res.name)
		return {id: id, name: res.name}
	}))

	return new Map(playlists.map(({name, id}) => [name, id]));
}

async function getSubPlaylists(combined_playlist_info) {
	// Getting sub-playlists
	let playlists = []
	combined_playlist_info.forEach((id, name) => {
		// Parse playlist name
		let tokens = name.split(' ')
		let h_str = tokens[0].slice(1)
		let e_str = tokens[1].slice(1)

		// Get H values
		let h_vals = []
		h_vals[0] = parseInt(h_str[0])
		if(h_str.length > 1) {
			let h_max = parseInt(h_str[2])
			while(h_vals[h_vals.length - 1] < h_max) {
				h_vals.push(h_vals[h_vals.length - 1] + 1)
			}
		}


		// Get E values
		let e_vals = []
		e_vals[0] = parseInt(e_str[0])
		if(e_str.length > 1) {
			let e_max = parseInt(e_str[2])
			while(e_vals[e_vals.length - 1] < e_max) {
				e_vals.push(e_vals[e_vals.length - 1] + 1)
			}
		}

		// Get corresponding playlists
		
		playlists[name] = []
		h_vals.forEach((h_val) => {
			e_vals.forEach((e_val) => {
				let prefix = 'H'
				playlists[name].push(prefix.concat(h_val, 'E', e_val))
			})
		})
	})

	return playlists
}


// Update playlists

async function removeFromPlaylist(track_id, playlist_id) {
	await fetchWebApi(`v1/playlists/${playlist_id}/tracks`, 'DELETE', [track_id])
}

async function clearPlaylist(playlist_id) {
	/* Step 1: get all track IDs inside this playlist */

	// Fetch first batch of tracks
	let tracks_json = await fetchWebApi(`v1/playlists/${playlist_id}/tracks`, 'GET')
	let tracks_info = tracks_json.items

	// Handle first batch of tracks
	let track_ids = []
	tracks_info.forEach((track_info) => {
		track_ids.push(track_info.track.id)
	})

	// Get any further batches of tracks

	tracks_json = await fetchWebApi(`v1/playlists/${playlist_id}/tracks`, 'GET')
	tracks_info = tracks_json.items
	console.log(tracks_json)
	
}

async function mergePlaylists() {

}

/* Calls begin here */

token = await getToken()

let basePlaylistInfo = await getPlaylistNames(config.base_playlist_ids)

let combinedPlaylistInfo = await getPlaylistNames(config.combined_playlist_ids)

let subPlaylists = await getSubPlaylists(combinedPlaylistInfo)

config.combined_playlist_ids.forEach((id) => {
	clearPlaylist(id)
})
