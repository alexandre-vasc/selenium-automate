/**
 * This script automatically ignore all Steam games on the current page.
 * Useful to mass ignore shovelware from a known shovelware developer.
 * 
 * Usage:
 * - you need to be logged into your steam's account on the Browser.
 * - load the page you want to ignore, for example:
 *   https://store.steampowered.com/curator/<curator id>
 * - open the Browser's developer tools (usually with F12)
 * - navegate to the console tab
 * - past the code on the console
 * 
 * !! Do not past random code on your terminal. Only execute code that you trust !!
 * 
 * The script will scroll down to load all games on the page.
 * After loading everything, it will ignore one game at a time.
 */

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

async function ignoreSteam() {

let oldLen
let elements

// We may need to scroll down multiple times to load all items
// lets scroll down in a loop until we find no more items    
do {
    oldLen = elements?.snapshotLength ?? 0
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1000);
    elements = document.evaluate("//a[@data-ds-appid] | //div[@data-ds-appid]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (!elements ) {
        break
    }
    console.log("Found " + elements.snapshotLength + " games to ignore for now. Last query had: " + oldLen)
    // continue until no more items
} while (elements.snapshotLength > oldLen)

if (elements?.snapshotLength == 0) {
    throw new Error("No game found on page")
} 
console.log("Found " + elements.snapshotLength + " games to ignore")


// extract the game IDs from the results
// filter games that are already ignored
const ids = new Set()
for (let i = 0; i < elements.snapshotLength; i++) {       
    const gameEl = elements.snapshotItem(i)
    const id = gameEl.getAttribute('data-ds-appid')
    if (!id) {
        console.log("Game id not found")
        continue
    }
    const alreadyIgnored = document.evaluate("./div[@class='ds_flag ds_ignored_flag']", gameEl, null,  XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);   
    if (alreadyIgnored) {
        const ignoreEl = alreadyIgnored.snapshotItem(0)
        if (ignoreEl) {
            console.log("Game id " + id + " is already ignored")
            continue
        }
    }  
    ids.add(id)
}
console.log("After filtering we have " + ids.size + " games to ignore")

// get Steam session from the cookie. Do not share this!
const sessionid = document.cookie.split('; ').find(row => row.startsWith('sessionid='))

if (!sessionid) {
    console.log("sessionid not found. can't make request to steam without it")    
} else {
    // build a request and send to Steam to let it known we want to ignore the game.
    const uaData = navigator.userAgentData;
    const secChUa = uaData?.brands?.map(b => `"${b.brand}";v="${b.version}"`).join(', ');

    for (const id of ids) {
        const fetchReturn = await fetch("https://store.steampowered.com/recommended/ignorerecommendation/", {
            "headers": {
                "accept": "*/*",
                "accept-language": navigator.languages.join(','),
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                ...(secChUa !== undefined && { "sec-ch-ua": secChUa }),
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Linux\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest",
                "cookie": document.cookie,
                "Referer": document.referrer,
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            "body": sessionid + "&appid=" + id + "&remove=0&snr=1_7_7_230_150_1",
            "method": "POST"
        });
        console.log("Ignoring id: " + id + " status code: " + fetchReturn.status)
        await sleep(2000);
    }
}
console.log("DONE")

}

ignoreSteam()