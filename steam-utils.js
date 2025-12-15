const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

// button to unfollow curator
const curatorXpath = "//div[@class='actions']/div/a[@class=' following_button btn_green_steamui btn_medium ']"

let scrollToBottom = async () => {
    let oldLen
    let elements
    // We may need to scroll down multiple times to load all items
    // lets scroll down in a loop until we find no more items    
    do {
        oldLen = elements?.snapshotLength ?? 0
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(1000);
        elements = document.evaluate(curatorXpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (!elements ) {
            break
        }
        console.log("Found " + elements.snapshotLength + " games to ignore for now. Last query had: " + oldLen)
        // continue until no more items
    } while (elements.snapshotLength > oldLen)
    return elements
}

let ignoreFollowedCurators = async () => {
    const elements = await scrollToBottom()

    // unfollow all curators
    if (elements?.snapshotLength > 0) {
        // we need to iterate an click on each element
        for (let i = 0; i < elements.snapshotLength; i++) {  
            console.log("Unfollowing curator " + i + " of " + elements.snapshotLength)
            const curatorEl = elements.snapshotItem(i)
            await curatorEl.click()
            await sleep(1000)            
        }
    } else {
        console.log("No curators to unfollow")
    
    }

}
ignoreFollowedCurators()