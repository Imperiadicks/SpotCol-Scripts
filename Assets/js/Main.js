console.log("[Main] v0.3.1")
window.Theme = new Theme('SpotColЛичная');
if (window.Theme?.SpotifyScreen && typeof window.Theme.SpotifyScreen.init === 'function') {
  window.Theme.SpotifyScreen.init(window.Theme.player);
}

/*--------------------------------------------*/
const observer = new MutationObserver(() => {
    let pin = document.querySelector('.PinItem_root__WSoCn > a[aria-label="Плейлист Мне нравится"]');
    if (pin) {
        let parentPin = pin.closest('.PinItem_root__WSoCn');
        if (parentPin && parentPin.parentNode.firstChild !== parentPin) {
            parentPin.parentNode.insertBefore(parentPin, parentPin.parentNode.firstChild);
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });
/*--------------------------------------------*/
// Отключение тупого даблклика
/*--------------------------------------------*/
function disableDoubleClick() {
    const elements = document.querySelectorAll('.PlayerBar_root__cXUnU');

    elements.forEach(element => {
        element.addEventListener('dblclick', function(event) {
            event.preventDefault();
            event.stopPropagation();
        }, true);
    });
}

setInterval(disableDoubleClick, 1000);
/*--------------------------------------------*/

// Google Noto Sans Font
/*--------------------------------------------*/
const link1 = document.createElement('link');
link1.rel = 'preconnect';
link1.href = 'https://fonts.googleapis.com';
document.head.appendChild(link1);

const link2 = document.createElement('link');
link2.rel = 'preconnect';
link2.href = 'https://fonts.gstatic.com';
link2.crossOrigin = 'anonymous';
document.head.appendChild(link2);

const link3 = document.createElement('link');
link3.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap';
link3.rel = 'stylesheet';
document.head.appendChild(link3);
/*--------------------------------------------*/

/*--------------------------------------------*/
/*Управление handleEvents.json*/
/*--------------------------------------------*/
let settings = {};

let updateInterval;
let settingsDelay = 1000;

function log(text) {
    console.log('[Customizable LOG]: ', text)
}

async function getSettings() {
    try {
        const response = await fetch("http://localhost:2007/get_handle?name=SpotColЛичная");
        if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
        const data = await response.json();
        if (!data?.data?.sections) {
            console.warn("Структура данных не соответствует ожидаемой.");
            return {};
        }
        return Object.fromEntries(data.data.sections.map(({ title, items }) => [
            title,
            Object.fromEntries(items.map(item => [
                item.id,
                item.bool ?? item.input ?? Object.fromEntries(item.buttons?.map(b => [b.name, b.text]) || [])
            ]))
        ]));
    } catch (error) {
        console.error("Ошибка при получении данных:", error);
        return {};
    }
}

async function setSettings(newSettings) {
    setInterval(() => {
        
        if (Object.keys(settings).length === 0 || settings['Действия'].myBackgroundButton !== newSettings['Действия'].myBackgroundButton) {
            setNewBackground(newSettings['Действия'].myBackgroundButton);
        }
    },5000)
    let buttonimage = document.getElementById('Button-image');
        if (!buttonimage) {
            buttonimage = document.createElement('style');
            buttonimage.id = 'Button-image';
            document.head.appendChild(buttonimage);
        }

        buttonimage.textContent = `.Skeleton_header__1uiIw{
        background: ${newSettings['Действия'].myBackgroundButton ? '0;' : 'var(--ym-background-color-primary-enabled-content);'}
        }
        `;
            // Open Blocker
    const modules = [
        'donations', 'concerts', 'userprofile', 'trailers', 'betabutton',
        'vibeanimation', 'globaltabs', 'relevantnow', 'instyle', 'likesandhistory', 'neuromusic',
        'newreleases', 'personalartists', 'personalplaylists', 'recommendedplaylists', 'smartopenplaylist',
        'waves', 'charttracks', 'artistrecommends', 'barbelow', 'podcasts', 'chartalbums',
        'continuelisten', 'editorialartists', 'editorialnewreleases', 'mixedblock',
        'mixesgrid', 'newplaylists', 'nonmusiceditorialcompilation', 'openplaylist'
    ];    

    modules.forEach(module => {
        const settingKey = `OB${module.charAt(0) + module.slice(1)}`;
        const cssId = `openblocker-${module}`;
        const existingLink = document.getElementById(cssId);
        
        if (Object.keys(settings).length === 0 || settings['Open-Blocker'][settingKey] !== newSettings['Open-Blocker'][settingKey]) {
            if (newSettings['Open-Blocker'][settingKey]) {
                if (existingLink) {
                    existingLink.remove();
                }
            } else {
                if (!existingLink) {
                    fetch(`https://raw.githubusercontent.com/Open-Blocker-FYM/Open-Blocker/refs/heads/main/blocker-css/${module}.css`)
                        .then(response => response.text())
                        .then(css => {
                            const style = document.createElement("style");
                            style.id = cssId;
                            style.textContent = css;
                            document.head.appendChild(style);
                        })
                        .catch(error => console.error(`Ошибка загрузки CSS: ${module}`, error));
                }
            }
        }
    });
    let combinedStyle = document.getElementById('combined-style');
    if (!combinedStyle) {
        combinedStyle = document.createElement('style');
        combinedStyle.id = 'combined-style';
        document.head.appendChild(combinedStyle);
    }
    
    combinedStyle.textContent = `
        .PlayerBarDesktop_root__d2Hwi 
        {
            background: ${newSettings['Действия'].togglePlayerBackground ? '0' : '1;'} !important;
        }
        .Content_main__8_wIa 
        {
            background: ${newSettings['Действия'].togglePlayerBackground ? '0' : '1;'} !important;
        }
        .Spotify_Screen 
        {
        background: ${newSettings['Действия'].togglePlayerBackground ? '0' : '1;'} !important;
        }
        .All_Info_Container
        {
        background: ${newSettings['Действия'].togglePlayerBackground ? '0' : '1;'} !important;
        }
        .Artist_Info_Container
        {
        background: ${newSettings['Действия'].togglePlayerBackground ? '0' : '1;'} !important;
        }
        .LikesAndHistoryItem_root__oI1gk
        {
        background: ${newSettings['Действия'].togglePlayerBackground ? '0;' : '1;'} !important;
        }
        .MixCard_root__9tPLV
        {
        background: ${newSettings['Действия'].togglePlayerBackground ? '0;' : '1;'} !important;
        }
        .nHWc2sto1C6Gm0Dpw_l0
        {   
        backdrop-filter:${newSettings['Действия'].togglePlayerBackground ? 'blur (0px);' : 'blur (50px);'} !important;
        }
        .VibeContext_context__Z_82k
        {
        backdrop-filter:${newSettings['Действия'].togglePlayerBackground ? 'blur (0px);' : 'blur (5px);'}
        }
        .NewReleaseCard_root__IY5m_
        {
        border: ${newSettings['Действия'].togglePlayerBackground ? '0px;' : '1px;'} !important;
        background: ${newSettings['Действия'].togglePlayerBackground ? '0;' : '1;'} !important;
        }
        .VibeButton_button__tXFAm
        {
        border: ${newSettings['Действия'].togglePlayerBackground ? '0px;' : '1px;'} !important;
        background: ${newSettings['Действия'].togglePlayerBackground ? '0;' : '1;'} !important;
        }
        .NeuromusicButton_button__kT4GN
        {
        border: ${newSettings['Действия'].togglePlayerBackground ? '0px;' : '1px;'} !important;
        background: ${newSettings['Действия'].togglePlayerBackground ? '0;' : '1;'} !important;       
        }
        .GPT_Info_Container
        {
        background: ${newSettings['Действия'].togglePlayerBackground ? '0;' : '1;'} !important; 
        }
        `;
        let Newbutton = document.getElementById('New-Button');
        if (!Newbutton) {
            Newbutton = document.createElement('style');
            Newbutton.id = 'New-Button';
            document.head.appendChild(Newbutton);
        }

        Newbutton.textContent = `.MainPage_vibe__XEBbh{
        height: ${newSettings['Действия'].Newbuttona ? '89vh;' : '57vh'}
        }
        `;
    
        let buttonhide = document.getElementById('Button-hide');
        if (!buttonhide) {
            buttonhide = document.createElement('style');
            buttonhide.id = 'Button-hide';
            document.head.appendChild(buttonhide);
        }

        buttonhide.textContent = `body > div.WithTopBanner_root__P__x3 > div > div > aside > div > div.NavbarDesktop_scrollableContainer__HLc9D > div > nav > ol > li:nth-child(3) > a > div.zpkgiiHgDpbBThy6gavq {
        visibility: ${newSettings['Действия'].NewbuttonHide ? 'Visible;' : 'hidden;'}
        }
        body > div.WithTopBanner_root__P__x3 > div > div > aside > div > div.NavbarDesktop_scrollableContainer__HLc9D > div > nav > ol > li:nth-child(4) > a > div.zpkgiiHgDpbBThy6gavq {
           left: ${newSettings['Действия'].NewbuttonHide ? '175px;' : '125px'};
    }`;
    // Auto Play
    if (newSettings['Действия'].devAutoPlayOnStart && !window.hasRun) {
        document.querySelector(`section.PlayerBar_root__cXUnU * [data-test-id="PLAY_BUTTON"]`)
        ?.click();
        window.hasRun = true;
    }
    
    // Update theme settings delay
    if (Object.keys(settings).length === 0 || settings['Особое'].setInterval.text !== newSettings['Особое'].setInterval.text) {
        const newDelay = parseInt(newSettings['Особое'].setInterval.text, 10) || 1000;
        if (settingsDelay !== newDelay) {
            settingsDelay = newDelay;

            // Обновление интервала
            clearInterval(updateInterval);
            updateInterval = setInterval(update, settingsDelay);
        }
    }
}

async function update() {
    const newSettings = await getSettings();
    await setSettings(newSettings);
    settings = newSettings;
}

function init() {
    update();
    updateInterval = setInterval(update, settingsDelay);
}

init();