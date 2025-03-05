import { readFileSync } from 'fs'
import fs from 'fs/promises'; // For saving the refresh token

const data = readFileSync('./config.json', 'utf-8')
const config = JSON.parse(data)
let token = ""

// Get authtoken for use in all other operations
async function getToken() {
    let { client_id, client_secret, refresh_token } = config;

    if (!refresh_token) {
        throw new Error("Missing refresh token in config.json. Authenticate manually first.");
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refresh_token,
            client_id: client_id,
            client_secret: client_secret
        })
    });

    if (!response.ok) {
        throw new Error(`Error fetching token: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Update config.json with new access token (optional but recommended)
    await updateConfig({ access_token: data.access_token });

    return data.access_token;
}

// Function to update config.json with new tokens
async function updateConfig(newData) {
    try {
        let configData = JSON.parse(await fs.readFile("config.json", "utf-8"));
        Object.assign(configData, newData);
        await fs.writeFile("config.json", JSON.stringify(configData, null, 4));
    } catch (error) {
        console.error("Error updating config.json:", error);
    }
}

export { getToken };

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


/* Playlist access functions */

// Returns a map with key=id, value=name
async function getPlaylistNames(playlist_ids){
	const playlists = await Promise.all(playlist_ids.map(async (id) => {
		let res = await fetchWebApi(`v1/playlists/${id}`, 'GET')
		return {id: id, name: res.name}
	}))

	return new Map(playlists.map(({name, id}) => [name, id]));
}

// Given a list of combined playlists, returns a map with key=combined playlist name, value=array of sub-playlist names
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

// Returns an array of all track IDs inside the specified playlist
async function getTracksFromPlaylist(playlistId) {
	let tracksJson = await fetchWebApi(`v1/playlists/${playlistId}/tracks`, 'GET')

	// Handle first batch of tracks
	let trackIds = []
	for (const trackInfo of tracksJson.items) {
		trackIds.push(trackInfo.track.id)
	}

	// Fetch any further batches of tracks
	let offset = tracksJson.offset
	let limit = tracksJson.limit

	while (tracksJson.next) {
		tracksJson = await fetchWebApi(`v1/playlists/${playlistId}/tracks?offset=${offset + limit}&limit=100`, 'GET')

		for (const trackInfo of tracksJson.items) {
			trackIds.push(trackInfo.track.id)
		}

		offset = tracksJson.offset
		limit = tracksJson.limit
	}

	return trackIds
}
// Removes the specified tracks from the specified playlist
async function removeFromPlaylist(trackUris, playlistId) {
	let res = await fetchWebApi(`v1/playlists/${playlistId}/tracks`, 'DELETE', trackUris)
	console.log(res)
}

// Adds the specified tracks to the specified playlist
async function addToPlaylist(trackUris, playlistId) {
	let res = await fetchWebApi(`v1/playlists/${playlistId}/tracks`, 'POST', trackUris)
	console.log(res)
}

// Combines track IDs into batches of the specified size. Returns JSON including tracks or URIs, depending on whether we're adding to a playlist or removing.
function batchTracks(trackIds, batchSize, isAdd) {
	let trackIdsBatched = Array.from({ length: Math.ceil(trackIds.length / batchSize) }, (_, i) =>
	    trackIds.slice(i * batchSize, i * batchSize + batchSize)
	)

	if(isAdd) {
		return trackIdsBatched.map(batch => ({
		    uris: batch.map(id => `spotify:track:${id}` )
		}))
	} else {
		return trackIdsBatched.map(batch => ({
		    tracks: batch.map(id => ({ uri: `spotify:track:${id}` }))
		}))
	}
}

// Update playlists

async function clearPlaylist(playlistId) {
	let trackIds = await getTracksFromPlaylist(playlistId)
	let trackIdsJson = batchTracks(trackIds, 100, false)

	trackIdsJson.forEach((batch) => {
		removeFromPlaylist(batch, playlistId)
	})
}

async function mergePlaylists(combinedPlaylistInfo, basePlaylistInfo, subPlaylists) {
	for (const [combName, combId] of combinedPlaylistInfo.entries()) {

		for (const subName of subPlaylists[combName]) {
			let basePlaylistId = basePlaylistInfo.get(subName)
			let trackIds = await getTracksFromPlaylist(basePlaylistId)

			let trackIdsJson = batchTracks(trackIds, 20, true)

			for (const batch of trackIdsJson) {
				await addToPlaylist(batch, combId)
			}
		}
	}
}

async function updatePlaylists() {
	token = await getToken()

	let basePlaylistInfo = await getPlaylistNames(config.base_playlist_ids)

	let combinedPlaylistInfo = await getPlaylistNames(config.combined_playlist_ids)

	let subPlaylists = await getSubPlaylists(combinedPlaylistInfo)

	for (const [combName, combId] of combinedPlaylistInfo.entries()) {
		clearPlaylist(combId)
	}
	await mergePlaylists(combinedPlaylistInfo, basePlaylistInfo, subPlaylists)
}

/* Calls begin here */
updatePlaylists()
