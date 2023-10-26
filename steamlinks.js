import { open } from 'node:fs/promises'

myFileReader();
async function myFileReader() {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    const file = await open('./steamlinks.txt');
    for await (const line of file.readLines()) {
        if (line.startsWith('http')) {
            checkifHasCard(line)
            await delay(2000)
        }
    }
    file.close()
}

async function checkifHasCard(line) {
    const response = await fetch(line)
    if (response.status == 200) {
        const html = await response.text()
        if (html.includes('ico_cards.png'))
        {
            console.log('cards')
        }
        else {
            console.log('no cards')
        }
    }
    else {
        console.error("Error fetching " + line)
    }
}