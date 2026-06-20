// Global state
let currentConfig = {};
let tempUploadedImages = {
    heroImg: null,
    gallery: [] // Array of base64 compressed images for the gallery
};
let countdownInterval = null;

// IndexedDB database manager
const dbStore = {
    dbName: "WeddingInvitationDB",
    dbVersion: 1,
    storeName: "Assets",
    db: null,
    
    init: function(callback) {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onerror = (event) => {
            console.error("IndexedDB load error: ", event);
            if (callback) callback(false);
        };
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
            if (callback) callback(true);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName);
            }
        };
    },
    
    get: function(key, callback) {
        if (!this.db) {
            if (callback) callback(null);
            return;
        }
        const transaction = this.db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        
        request.onsuccess = (event) => {
            if (callback) callback(request.result);
        };
        
        request.onerror = () => {
            if (callback) callback(null);
        };
    },
    
    set: function(key, value, callback) {
        if (!this.db) {
            if (callback) callback(false);
            return;
        }
        const transaction = this.db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.put(value, key);
        
        request.onsuccess = () => {
            if (callback) callback(true);
        };
        
        request.onerror = () => {
            if (callback) callback(false);
        };
    },
    
    remove: function(key, callback) {
        if (!this.db) {
            if (callback) callback(false);
            return;
        }
        const transaction = this.db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);
        
        request.onsuccess = () => {
            if (callback) callback(true);
        };
        
        request.onerror = () => {
            if (callback) callback(false);
        };
    }
};

// Default Invitation Settings
const DEFAULT_CONFIG = {
    groomName: "이건호",
    brideName: "최서희",
    groomParents: "이승우 · 오용희",
    brideParents: "최홍윤 · 황유림",
    weddingDate: "2026-10-24",
    weddingTime: "12:00",
    venueName: "수원 정자동 주교좌성당",
    venueAddress: "경기도 수원시 장안구 이목로 37",
    venuePhone: "Tel. 031-252-6776",
    greetingTitle: "소중한 분들을 초대합니다",
    greetingContent: `서로 마주 보며 자라온 두 사람이
이제 같은 곳을 바라보며 나아가고자 합니다.

저희 두 사람의 약속을 완성하는 특별한 날,
가까이서 축복해 주시면 더없는 기쁨이 되겠습니다.
귀한 발걸음으로 저희의 시작을 함께해 주십시오.`,
    groomBank1: "국민은행",
    groomAccount1: "110-345-678901",
    groomOwner1: "이건호",
    groomBankParent: "신한은행",
    groomAccountParent: "012-345-6789",
    groomOwnerParent: "이승우 (혼주)",
    brideBank1: "우리은행",
    brideAccount1: "1002-123-456789",
    brideOwner1: "최서희",
    brideBankParent: "하나은행",
    brideAccountParent: "987-654-321012",
    brideOwnerParent: "최홍윤 (혼주)"
};

// Initialize application
document.addEventListener("DOMContentLoaded", function() {
    lucide.createIcons();
    
    // Initialize Database first, then load configurations
    dbStore.init((success) => {
        if (success) {
            loadConfiguration();
        } else {
            // Fallback load if IndexedDB fails
            console.warn("IndexedDB initialization failed. Using defaults.");
            currentConfig = Object.assign({}, DEFAULT_CONFIG);
            applyConfigToDOM();
        }
        initScrollAnimations();
        initClipboard();
        initAccordion();
        initGuestbook();
        initRsvp();
        initEditor();
        initProtection();
    });
});

// 1. Load configuration and apply to DOM
function loadConfiguration() {
    const savedTextConfig = localStorage.getItem('wedding_invitation_config_v2');
    if (savedTextConfig) {
        try {
            currentConfig = JSON.parse(savedTextConfig);
            currentConfig = Object.assign({}, DEFAULT_CONFIG, currentConfig);
        } catch (e) {
            currentConfig = Object.assign({}, DEFAULT_CONFIG);
        }
    } else {
        currentConfig = Object.assign({}, DEFAULT_CONFIG);
    }
    
    // Load images asynchronously from IndexedDB
    dbStore.get('custom_hero_img', (heroBase64) => {
        const heroImg = heroBase64 || "images/wedding_hero.png";
        document.getElementById('hero-wedding-img').src = heroImg;
        
        dbStore.get('custom_gallery_images', (galleryArray) => {
            const list = (galleryArray && galleryArray.length > 0) ? galleryArray : generateDefaultGalleryArray();
            renderGalleryGrid(list);
            applyConfigToDOM(heroImg, list);
        });
    });
}

function generateDefaultGalleryArray() {
    const defaults = [
        "images/wedding_hero.png",
        "images/wedding_gallery_1.png",
        "images/wedding_gallery_2.png"
    ];
    const list = [];
    // Repeat default images to show a beautiful 30-image list dynamically
    for (let i = 0; i < 30; i++) {
        list.push(defaults[i % defaults.length]);
    }
    return list;
}

function applyConfigToDOM(heroImg, galleryList) {
    // Text elements updates
    document.getElementById('txt-groom-name-main').innerText = currentConfig.groomName;
    document.getElementById('txt-bride-name-main').innerText = currentConfig.brideName;
    
    // Formatting date meta
    const dateObj = new Date(currentConfig.weddingDate);
    const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const weekdaysKr = ["일", "월", "화", "수", "목", "금", "토"];
    const wDay = weekdays[dateObj.getDay()];
    
    // Parse time
    const timeParts = currentConfig.weddingTime.split(":");
    let hour = parseInt(timeParts[0], 10);
    const minute = timeParts[1] || "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    const formattedTime = `${ampm} ${hour}:${minute}`;
    
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    
    document.getElementById('txt-wedding-date-meta').innerText = `${year}. ${month}. ${day}. ${wDay}. ${formattedTime}`;
    document.getElementById('txt-wedding-venue-meta').innerText = currentConfig.venueName;
    
    // Greetings
    document.getElementById('txt-greeting-title').innerText = currentConfig.greetingTitle;
    document.getElementById('txt-greeting-content').innerHTML = currentConfig.greetingContent.replace(/\n/g, '<br>');
    document.getElementById('txt-groom-parents').innerText = currentConfig.groomParents;
    document.getElementById('txt-groom-name').innerText = currentConfig.groomName;
    document.getElementById('txt-bride-parents').innerText = currentConfig.brideParents;
    document.getElementById('txt-bride-name').innerText = currentConfig.brideName;
    
    // Countdown names
    document.getElementById('txt-countdown-names').innerText = `${currentConfig.groomName}와 ${currentConfig.brideName}`;
    
    // Venue details
    document.getElementById('txt-venue-name').innerText = currentConfig.venueName;
    document.getElementById('txt-venue-address').innerText = currentConfig.venueAddress;
    document.getElementById('txt-venue-phone').innerText = currentConfig.venuePhone;
    document.getElementById('txt-map-pin').innerText = currentConfig.venueName;
    
    // Map Search URL update
    document.getElementById('btn-naver-map').href = `https://map.naver.com/v5/search/${encodeURIComponent(currentConfig.venueName)}`;
    document.getElementById('btn-kakao-map').href = `https://map.kakao.com/?q=${encodeURIComponent(currentConfig.venueName)}`;
    
    // Bank accounts
    document.getElementById('groom-bank-1').innerText = currentConfig.groomBank1;
    document.getElementById('groom-account-1').innerText = currentConfig.groomAccount1;
    document.getElementById('groom-owner-1').innerText = currentConfig.groomOwner1;
    
    document.getElementById('groom-bank-parent').innerText = currentConfig.groomBankParent;
    document.getElementById('groom-account-parent').innerText = currentConfig.groomAccountParent;
    document.getElementById('groom-owner-parent').innerText = currentConfig.groomOwnerParent;
    
    document.getElementById('bride-bank-1').innerText = currentConfig.brideBank1;
    document.getElementById('bride-account-1').innerText = currentConfig.brideAccount1;
    document.getElementById('bride-owner-1').innerText = currentConfig.brideOwner1;
    
    document.getElementById('bride-bank-parent').innerText = currentConfig.brideBankParent;
    document.getElementById('bride-account-parent').innerText = currentConfig.brideAccountParent;
    document.getElementById('bride-owner-parent').innerText = currentConfig.brideOwnerParent;
    
    // Generate Calendar dynamically
    renderDynamicCalendar(currentConfig.weddingDate);
    
    // Reset and start countdown
    initCountdown();
}

// 2. Dynamic Calendar Rendering
function renderDynamicCalendar(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const calendarDateTitle = document.getElementById('txt-calendar-date');
    calendarDateTitle.innerText = `${year}. ${String(month + 1).padStart(2, '0')}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const tbody = document.getElementById('calendar-body');
    tbody.innerHTML = '';
    
    let currentDay = 1;
    let html = '';
    
    for (let i = 0; i < 6; i++) {
        if (currentDay > totalDays) break;
        html += '<tr>';
        for (let j = 0; j < 7; j++) {
            const cellIndex = i * 7 + j;
            if (cellIndex < firstDay || currentDay > totalDays) {
                html += '<td class="empty"></td>';
            } else {
                let className = '';
                if (j === 0) className = 'sun';
                else if (j === 6) className = 'sat';
                
                if (currentDay === day) {
                    className += ' wedding-day';
                }
                
                html += `<td class="${className.trim()}">${currentDay}</td>`;
                currentDay++;
            }
        }
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

// 3. Render Dynamic Gallery Grid
function renderGalleryGrid(imagesArray) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    
    imagesArray.forEach((src, index) => {
        const item = document.createElement('div');
        // Render all items as 1x1 to achieve a clean 3x3 layout
        item.className = 'gallery-item';
        
        // Hide items beyond index 8 (9th photo onwards)
        if (index >= 9) {
            item.classList.add('gallery-item-hidden');
        }
        
        item.innerHTML = `
            <div class="img-protection-wrapper">
                <img src="${src}" alt="갤러리 이미지 ${index + 1}" class="gallery-img" data-index="${index}">
                <div class="img-overlay"></div>
            </div>
        `;
        grid.appendChild(item);
    });
    
    // Toggle container visibility based on total images
    const toggleContainer = document.getElementById('gallery-toggle-container');
    if (toggleContainer) {
        if (imagesArray.length > 9) {
            toggleContainer.style.display = 'flex';
            initGalleryToggle();
        } else {
            toggleContainer.style.display = 'none';
        }
    }
    
    initLightbox(imagesArray);
}

// 3b. Initialize Gallery Expand/Collapse Toggle
function initGalleryToggle() {
    const toggleBtn = document.getElementById('btn-gallery-toggle');
    if (!toggleBtn) return;
    
    // Remove existing event listener if any
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    newToggleBtn.addEventListener('click', function() {
        const grid = document.getElementById('gallery-grid');
        const toggleText = document.getElementById('txt-gallery-toggle');
        const isExpanded = grid.classList.contains('expanded');
        
        if (isExpanded) {
            grid.classList.remove('expanded');
            toggleText.innerText = '더보기';
            
            // Scroll back to the top of the gallery section smoothly
            document.querySelector('.section.gallery').scrollIntoView({ behavior: 'smooth' });
        } else {
            grid.classList.add('expanded');
            toggleText.innerText = '접기';
        }
    });
}

// 4. Scroll Animations
function initScrollAnimations() {
    const animElements = document.querySelectorAll('.animate-on-scroll');
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    animElements.forEach(el => {
        observer.observe(el);
    });
}

// 5. Countdown Timer
function initCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    const targetStr = `${currentConfig.weddingDate}T${currentConfig.weddingTime}:00`;
    const targetDate = new Date(targetStr).getTime();
    
    const daysEl = document.getElementById("days");
    const hoursEl = document.getElementById("hours");
    const minutesEl = document.getElementById("minutes");
    const secondsEl = document.getElementById("seconds");
    const statusEl = document.getElementById("countdown-status");
    
    function updateTimer() {
        const now = new Date().getTime();
        const distance = targetDate - now;
        
        if (isNaN(distance) || distance < 0) {
            clearInterval(countdownInterval);
            daysEl.innerText = "00";
            hoursEl.innerText = "00";
            minutesEl.innerText = "00";
            secondsEl.innerText = "00";
            statusEl.innerText = "축하해주셔서 감사합니다! 예식이 시작되었습니다.";
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        daysEl.innerText = String(days).padStart(2, '0');
        hoursEl.innerText = String(hours).padStart(2, '0');
        minutesEl.innerText = String(minutes).padStart(2, '0');
        secondsEl.innerText = String(seconds).padStart(2, '0');
        statusEl.innerText = "남았습니다.";
    }
    
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

// 6. Lightbox Navigation
function initLightbox(imagesList) {
    const galleryImgs = document.querySelectorAll('.gallery-img');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    
    let currentIndex = 0;
    
    function openLightbox(index) {
        currentIndex = index;
        lightboxImg.src = imagesList[currentIndex];
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function showNext() {
        currentIndex = (currentIndex + 1) % imagesList.length;
        lightboxImg.src = imagesList[currentIndex];
    }
    
    function showPrev() {
        currentIndex = (currentIndex - 1 + imagesList.length) % imagesList.length;
        lightboxImg.src = imagesList[currentIndex];
    }
    
    // Bind click events on gallery items
    galleryImgs.forEach((img) => {
        img.parentNode.addEventListener('click', function() {
            const idx = parseInt(img.getAttribute('data-index'), 10);
            openLightbox(idx);
        });
    });
    
    // Bind click event on Hero image (Hero is image index 0 in lightbox array if clicked)
    const heroOverlay = document.querySelector('.hero-img-container .img-overlay');
    if (heroOverlay) {
        // Remove old event listeners
        const newHeroOverlay = heroOverlay.cloneNode(true);
        heroOverlay.parentNode.replaceChild(newHeroOverlay, heroOverlay);
        newHeroOverlay.addEventListener('click', function() {
            // Hero expands inside lightbox with hero source
            dbStore.get('custom_hero_img', (heroBase64) => {
                const src = heroBase64 || "images/wedding_hero.png";
                openLightbox(0); // Opens lightbox at index 0 (using current imagesList)
                // Temp override source for hero
                lightboxImg.src = src;
            });
        });
    }
    
    closeBtn.onclick = closeLightbox;
    nextBtn.onclick = showNext;
    prevBtn.onclick = showPrev;
    
    lightbox.onclick = function(e) {
        if (e.target === lightbox || e.target.classList.contains('lightbox-img-container')) {
            closeLightbox();
        }
    };
    
    document.onkeydown = function(e) {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
    };
}

// 7. Clipboard API
function initClipboard() {
    const copyBtns = document.querySelectorAll('.copy-btn');
    const toast = document.getElementById('toast');
    let toastTimeout;
    
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (!targetEl) return;
            
            const textToCopy = targetEl.innerText;
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                clearTimeout(toastTimeout);
                toast.classList.add('active');
                
                toastTimeout = setTimeout(() => {
                    toast.classList.remove('active');
                }, 2000);
            }).catch(err => {
                console.error('클립보드 복사 실패: ', err);
            });
        });
    });
}

// 8. Accordion
function initAccordion() {
    const headers = document.querySelectorAll('.accordion-header');
    
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const item = this.parentNode;
            const isActive = item.classList.contains('active');
            
            document.querySelectorAll('.accordion-item').forEach(el => {
                el.classList.remove('active');
            });
            
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// ===== 서버 연동 설정 =====
// Apps Script 배포 후 받은 웹 앱 URL을 여기에 붙여넣으세요.
// 예: const API_URL = "https://script.google.com/macros/s/AKfycb..../exec";
const API_URL = "여기에_APPS_SCRIPT_웹앱_URL_붙여넣기";

// 공용 escapeHtml (방명록/RSVP 양쪽에서 사용)
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 서버로 데이터 전송 (no-cors: 응답 본문은 못 읽지만 저장은 됨)
function postToServer(payload) {
    return fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
}

// 9. Guestbook (Google Spreadsheet 연동)
function initGuestbook() {
    const form = document.getElementById('guestbook-form');
    const nameInput = document.getElementById('guestbook-name');
    const passwordInput = document.getElementById('guestbook-password');
    const messageInput = document.getElementById('guestbook-message');
    const listContainer = document.getElementById('guestbook-list');
    const submitBtn = document.getElementById('guestbook-submit-btn');

    // 서버에서 방명록 목록 불러오기
    async function loadMessages() {
        listContainer.innerHTML = '<div style="text-align:center; color:#888; font-size:0.85rem; padding: 1.5rem 0;">불러오는 중...</div>';
        try {
            const res = await fetch(API_URL + '?type=guestbook&t=' + Date.now());
            const data = await res.json();
            renderMessages(data);
        } catch (e) {
            console.error('방명록 로드 실패:', e);
            listContainer.innerHTML = '<div style="text-align:center; color:#c0392b; font-size:0.85rem; padding: 1.5rem 0;">방명록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        }
    }

    function renderMessages(messages) {
        listContainer.innerHTML = '';
        if (!messages || messages.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#888; font-size:0.85rem; padding: 1.5rem 0;">첫 축하 한마디를 남겨보세요!</div>';
            return;
        }
        // 최신순 정렬 (id = 타임스탬프)
        const sorted = [...messages].sort((a, b) => b.id - a.id);
        sorted.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'message-card';
            card.innerHTML = `
                <div class="message-header">
                    <span class="message-author">${escapeHtml(msg.name)}</span>
                    <div class="message-meta">
                        <span class="message-date">${escapeHtml(msg.date)}</span>
                        <button class="delete-btn" data-id="${msg.id}">삭제</button>
                    </div>
                </div>
                <div class="message-body">${escapeHtml(msg.message)}</div>
            `;
            listContainer.appendChild(card);
        });

        listContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteMessage(this.getAttribute('data-id'));
            });
        });
    }

    async function deleteMessage(id) {
        const pwd = prompt("메시지 삭제를 위한 비밀번호를 입력해주세요:");
        if (pwd === null) return;
        try {
            await postToServer({ type: 'guestbook_delete', id: id, password: pwd });
            alert("삭제 요청이 처리되었습니다. 잠시 후 목록이 갱신됩니다.");
            setTimeout(loadMessages, 1200);
        } catch (e) {
            alert("삭제 처리 중 오류가 발생했습니다.");
        }
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = nameInput.value.trim();
        const password = passwordInput.value.trim();
        const message = messageInput.value.trim();
        if (!name || !password || !message) return;

        submitBtn.disabled = true;
        submitBtn.textContent = '등록 중...';

        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

        try {
            await postToServer({
                type: 'guestbook',
                id: Date.now(),
                name, password, message, date: dateStr
            });
            nameInput.value = '';
            passwordInput.value = '';
            messageInput.value = '';
            // 서버 기록 후 약간의 지연을 두고 새로고침
            setTimeout(loadMessages, 1200);
        } catch (err) {
            alert("등록 중 오류가 발생했습니다. 다시 시도해주세요.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '축하 메시지 등록';
        }
    });

    loadMessages();
}

// 9-2. RSVP (참석 여부 + 인원수)
function initRsvp() {
    const form = document.getElementById('rsvp-form');
    if (!form) return;

    const nameInput = document.getElementById('rsvp-name');
    const sideInputs = form.querySelectorAll('input[name="rsvp-side"]');
    const attendInputs = form.querySelectorAll('input[name="rsvp-attend"]');
    const countInput = document.getElementById('rsvp-count');
    const submitBtn = document.getElementById('rsvp-submit-btn');
    const statusEl = document.getElementById('rsvp-status');
    const countRow = document.getElementById('rsvp-count-row');

    // 불참 선택 시 인원수 입력 숨김
    attendInputs.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'N') {
                countRow.style.display = 'none';
            } else {
                countRow.style.display = '';
            }
        });
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = nameInput.value.trim();
        const side = [...sideInputs].find(r => r.checked)?.value || '';
        const attend = [...attendInputs].find(r => r.checked)?.value || '';
        const count = (attend === 'N') ? 0 : (parseInt(countInput.value, 10) || 1);

        if (!name || !side || !attend) {
            statusEl.textContent = '이름, 측, 참석 여부를 모두 선택해주세요.';
            statusEl.style.color = '#c0392b';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '전달 중...';
        statusEl.textContent = '';

        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

        try {
            await postToServer({
                type: 'rsvp',
                id: Date.now(),
                name,
                side: side === 'groom' ? '신랑측' : '신부측',
                attend: attend === 'Y' ? '참석' : '불참',
                count, date: dateStr
            });
            statusEl.textContent = '참석 정보가 전달되었습니다. 감사합니다!';
            statusEl.style.color = '#2e7d32';
            form.reset();
            countRow.style.display = '';
        } catch (err) {
            statusEl.textContent = '전달 중 오류가 발생했습니다. 다시 시도해주세요.';
            statusEl.style.color = '#c0392b';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '참석 정보 전달하기';
        }
    });
}

// 10. Editor Panel Customization
function initEditor() {
    const urlParams = new URLSearchParams(window.location.search);
    const editToggleBtn = document.getElementById('edit-toggle-btn');
    const editPanel = document.getElementById('edit-panel');
    const closeBtn = document.getElementById('edit-panel-close-btn');
    const saveBtn = document.getElementById('btn-edit-save');
    const resetBtn = document.getElementById('btn-edit-reset');
    
    const uploadHeroInput = document.getElementById('upload-hero-img');
    const previewHeroImg = document.getElementById('preview-hero-img');
    
    const uploadGalleryMulti = document.getElementById('upload-gallery-multi');
    const galleryStatusEl = document.getElementById('gallery-upload-status');
    const previewsContainer = document.getElementById('editor-gallery-previews');
    
    // Toggle Settings Gear Button
    if (urlParams.get('edit') === 'true') {
        editToggleBtn.style.display = 'flex';
    }
    
    editToggleBtn.addEventListener('click', function() {
        tempUploadedImages = {
            heroImg: null,
            gallery: []
        };
        
        // Open DB and populate current saved images
        dbStore.get('custom_hero_img', (heroBase64) => {
            if (heroBase64) {
                previewHeroImg.src = heroBase64;
                tempUploadedImages.heroImg = heroBase64;
            } else {
                previewHeroImg.src = "images/wedding_hero.png";
            }
            
            dbStore.get('custom_gallery_images', (galleryArray) => {
                if (galleryArray && galleryArray.length > 0) {
                    tempUploadedImages.gallery = [...galleryArray];
                } else {
                    tempUploadedImages.gallery = [];
                }
                
                populateForm();
                updateGalleryEditorUI();
                editPanel.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });
    });
    
    closeBtn.addEventListener('click', function() {
        editPanel.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    function populateForm() {
        document.getElementById('input-groom-name').value = currentConfig.groomName;
        document.getElementById('input-bride-name').value = currentConfig.brideName;
        document.getElementById('input-groom-parents').value = currentConfig.groomParents;
        document.getElementById('input-bride-parents').value = currentConfig.brideParents;
        
        document.getElementById('input-wedding-date').value = currentConfig.weddingDate;
        document.getElementById('input-wedding-time').value = currentConfig.weddingTime;
        
        document.getElementById('input-venue-name').value = currentConfig.venueName;
        document.getElementById('input-venue-address').value = currentConfig.venueAddress;
        document.getElementById('input-venue-phone').value = currentConfig.venuePhone;
        
        document.getElementById('input-greeting-title').value = currentConfig.greetingTitle;
        document.getElementById('input-greeting-content').value = currentConfig.greetingContent;
        
        document.getElementById('input-groom-bank-1').value = currentConfig.groomBank1;
        document.getElementById('input-groom-account-1').value = currentConfig.groomAccount1;
        document.getElementById('input-groom-owner-1').value = currentConfig.groomOwner1;
        document.getElementById('input-groom-bank-parent').value = currentConfig.groomBankParent;
        document.getElementById('input-groom-account-parent').value = currentConfig.groomAccountParent;
        document.getElementById('input-groom-owner-parent').value = currentConfig.groomOwnerParent;
        
        document.getElementById('input-bride-bank-1').value = currentConfig.brideBank1;
        document.getElementById('input-bride-account-1').value = currentConfig.brideAccount1;
        document.getElementById('input-bride-owner-1').value = currentConfig.brideOwner1;
        document.getElementById('input-bride-bank-parent').value = currentConfig.brideBankParent;
        document.getElementById('input-bride-account-parent').value = currentConfig.brideAccountParent;
        document.getElementById('input-bride-owner-parent').value = currentConfig.brideOwnerParent;
    }
    
    // Single file uploader (Hero Image)
    uploadHeroInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        previewHeroImg.style.opacity = '0.5';
        compressImage(file, 800, 0.70, (base64) => {
            previewHeroImg.src = base64;
            previewHeroImg.style.opacity = '1';
            tempUploadedImages.heroImg = base64;
        });
    });
    
    // Multi uploader (Gallery Images up to 30)
    uploadGalleryMulti.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        const maxLimit = 30;
        // Slice files list to restrict overflow
        const availableSlots = maxLimit - tempUploadedImages.gallery.length;
        if (availableSlots <= 0) {
            alert("이미 30장의 사진이 모두 등록되어 있습니다.");
            return;
        }
        
        const filesToProcess = files.slice(0, availableSlots);
        let processed = 0;
        
        galleryStatusEl.innerText = `사진 압축 중... (${processed} / ${filesToProcess.length})`;
        
        function processNext() {
            if (processed >= filesToProcess.length) {
                galleryStatusEl.innerText = `등록된 갤러리 사진: ${tempUploadedImages.gallery.length} / 30 장`;
                updateGalleryEditorUI();
                return;
            }
            const file = filesToProcess[processed];
            compressImage(file, 800, 0.70, (base64) => {
                tempUploadedImages.gallery.push(base64);
                processed++;
                galleryStatusEl.innerText = `사진 압축 중... (${processed} / ${filesToProcess.length})`;
                processNext();
            });
        }
        processNext();
    });
    
    // Update thumbnail list in uploader UI
    function updateGalleryEditorUI() {
        previewsContainer.innerHTML = '';
        galleryStatusEl.innerText = `등록된 갤러리 사진: ${tempUploadedImages.gallery.length} / 30 장`;
        
        if (tempUploadedImages.gallery.length === 0) {
            previewsContainer.innerHTML = '<div style="font-size:0.75rem; color:#888; text-align:center; width:100%; padding:1rem 0;">등록된 사진이 없습니다. 다중 업로드로 사진을 등록해보세요.</div>';
            return;
        }
        
        tempUploadedImages.gallery.forEach((base64, index) => {
            const thumbCard = document.createElement('div');
            thumbCard.className = 'editor-gal-thumb-card';
            thumbCard.innerHTML = `
                <img src="${base64}" alt="미리보기">
                <button class="delete-thumb-btn" data-index="${index}">&times;</button>
            `;
            previewsContainer.appendChild(thumbCard);
        });
        
        // Attach deletion listeners inside editor
        previewsContainer.querySelectorAll('.delete-thumb-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const indexToDelete = parseInt(this.getAttribute('data-index'), 10);
                tempUploadedImages.gallery.splice(indexToDelete, 1);
                updateGalleryEditorUI();
            });
        });
    }
    
    // Client-side image compression
    function compressImage(file, maxWidth, quality, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                callback(dataUrl);
            };
        };
    }
    
    // Save settings
    saveBtn.addEventListener('click', function() {
        const newConfig = {
            groomName: document.getElementById('input-groom-name').value.trim(),
            brideName: document.getElementById('input-bride-name').value.trim(),
            groomParents: document.getElementById('input-groom-parents').value.trim(),
            brideParents: document.getElementById('input-bride-parents').value.trim(),
            
            weddingDate: document.getElementById('input-wedding-date').value,
            weddingTime: document.getElementById('input-wedding-time').value,
            
            venueName: document.getElementById('input-venue-name').value.trim(),
            venueAddress: document.getElementById('input-venue-address').value.trim(),
            venuePhone: document.getElementById('input-venue-phone').value.trim(),
            
            greetingTitle: document.getElementById('input-greeting-title').value.trim(),
            greetingContent: document.getElementById('input-greeting-content').value,
            
            groomBank1: document.getElementById('input-groom-bank-1').value.trim(),
            groomAccount1: document.getElementById('input-groom-account-1').value.trim(),
            groomOwner1: document.getElementById('input-groom-owner-1').value.trim(),
            groomBankParent: document.getElementById('input-groom-bank-parent').value.trim(),
            groomAccountParent: document.getElementById('input-groom-account-parent').value.trim(),
            groomOwnerParent: document.getElementById('input-groom-owner-parent').value.trim(),
            
            brideBank1: document.getElementById('input-bride-bank-1').value.trim(),
            brideAccount1: document.getElementById('input-bride-account-1').value.trim(),
            brideOwner1: document.getElementById('input-bride-owner-1').value.trim(),
            brideBankParent: document.getElementById('input-bride-bank-parent').value.trim(),
            brideAccountParent: document.getElementById('input-bride-account-parent').value.trim(),
            brideOwnerParent: document.getElementById('input-bride-owner-parent').value.trim()
        };
        
        // Save text details
        localStorage.setItem('wedding_invitation_config_v2', JSON.stringify(newConfig));
        currentConfig = newConfig;
        
        // Save photos asynchronously in IndexedDB
        const savePromises = [];
        
        if (tempUploadedImages.heroImg) {
            savePromises.push(new Promise((resolve) => {
                dbStore.set('custom_hero_img', tempUploadedImages.heroImg, resolve);
            }));
        }
        
        // Always save the current state of uploader gallery images array
        savePromises.push(new Promise((resolve) => {
            dbStore.set('custom_gallery_images', tempUploadedImages.gallery, resolve);
        }));
        
        Promise.all(savePromises).then(() => {
            // Re-render and apply changes
            const heroSrc = tempUploadedImages.heroImg || "images/wedding_hero.png";
            document.getElementById('hero-wedding-img').src = heroSrc;
            
            const list = (tempUploadedImages.gallery && tempUploadedImages.gallery.length > 0) ? tempUploadedImages.gallery : generateDefaultGalleryArray();
            renderGalleryGrid(list);
            applyConfigToDOM(heroSrc, list);
            
            editPanel.classList.remove('active');
            document.body.style.overflow = '';
            
            alert("청첩장 텍스트 및 사진 정보가 안전하게 저장되었습니다!");
        });
    });
    
    // Reset defaults
    resetBtn.addEventListener('click', function() {
        if (confirm("정말 초기 기본값으로 되돌리시겠습니까? 작성한 글과 모든 커스텀 이미지(30장 갤러리 포함)가 복구 불가능하게 삭제됩니다.")) {
            localStorage.removeItem('wedding_invitation_config_v2');
            currentConfig = Object.assign({}, DEFAULT_CONFIG);
            
            dbStore.remove('custom_hero_img', () => {
                dbStore.remove('custom_gallery_images', () => {
                    // Force reload
                    window.location.reload();
                });
            });
        }
    });
}

// 11. Custom enhanced protection features
function initProtection() {
    const common = {
        isMobileDevice: function() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },
        devtoolLog: function(code) {
            console.log("[Protection Code active]: " + code);
            if (code === '3') {
                showSecurityOverlay();
            }
        }
    };

    function showSecurityOverlay() {
        if (document.getElementById('security-notice-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'security-notice-overlay';
        overlay.innerHTML = `
            <div class="security-card" style="
                background-color: #FFFFFF;
                border: 1px solid var(--border-color);
                padding: 2.2rem;
                border-radius: 12px;
                max-width: 90%;
                width: 360px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(142, 117, 169, 0.3);
                font-family: 'Noto Serif KR', serif;
                color: var(--text-dark);
            ">
                <h3 style="color: var(--lavender-dark); margin-bottom: 1rem; font-size: 1.15rem; font-weight: 600;">보안 안내</h3>
                <p style="font-size: 0.85rem; line-height: 1.7; margin-bottom: 1.5rem; color: var(--text-muted);">
                    본 청첩장의 무단 사진 도용 및 소스 분석을 차단하기 위해 개발자 도구 감지 보호 장치가 실행되었습니다.
                </p>
                <p style="font-size: 0.8rem; color: #a9a3b2; margin-bottom: 1.5rem;">
                    개발자 도구(Inspect Element)를 닫아주시면 이 안내가 사라집니다.
                </p>
                <button onclick="window.location.reload();" style="
                    background-color: var(--lavender-dark);
                    color: white;
                    border: none;
                    padding: 0.5rem 1.5rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-family: inherit;
                    cursor: pointer;
                    transition: background-color 0.2s;
                ">새로고침</button>
            </div>
        `;
        
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(44, 38, 51, 0.97)',
            zIndex: '99999',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });
        
        document.body.appendChild(overlay);
        
        overlay.addEventListener('contextmenu', e => e.preventDefault());
        overlay.addEventListener('keydown', e => e.preventDefault());
    }

    // A. Disable Right Click
    document.oncontextmenu = function(e) {
        return false;
    };

    // B. Disable Drag & Drop globally
    document.ondragstart = function() {
        return false;
    };

    // C. Intercept and block shortcut keys
    window.addEventListener('keydown', function(event) {
        // F12 key (123)
        if (event.keyCode === 123) {
            event.preventDefault();
            event.returnValue = false;
            common.devtoolLog('0');
            return false;
        }
        
        // Ctrl + Shift + I (73 is 'I')
        const isIKey = event.keyCode === 73 || event.keycode === 73;
        if (event.ctrlKey && event.shiftKey && isIKey) {
            event.preventDefault();
            event.returnValue = false;
            common.devtoolLog('1');
            return false;
        }
        
        // Ctrl + S (Save Page) - 83 is 'S'
        const isSKey = event.keyCode === 83 || event.keycode === 83;
        if (event.ctrlKey && isSKey) {
            event.preventDefault();
            event.returnValue = false;
            common.devtoolLog('S-SAVE');
            return false;
        }

        // Ctrl + C (Copy) - 67 is 'C'
        const isCKey = event.keyCode === 67 || event.keycode === 67;
        // Let them copy bank account in input fields if active, but block globally elsewhere
        const activeTagName = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isInputActive = activeTagName === 'input' || activeTagName === 'textarea';
        
        if (event.ctrlKey && isCKey && !isInputActive) {
            event.preventDefault();
            event.returnValue = false;
            common.devtoolLog('C-COPY');
            return false;
        }

        // Ctrl + P (Print) - 80 is 'P'
        const isPKey = event.keyCode === 80 || event.keycode === 80;
        if (event.ctrlKey && isPKey) {
            event.preventDefault();
            event.returnValue = false;
            common.devtoolLog('P-PRINT');
            return false;
        }

        // Ctrl + U (View Source) - 85 is 'U'
        const isUKey = event.keyCode === 85 || event.keycode === 85;
        if (event.ctrlKey && isUKey) {
            event.preventDefault();
            event.returnValue = false;
            common.devtoolLog('U-SOURCE');
            return false;
        }
    });

    // D. Debugger/timing trap (Desktop only)
    const isMobile = common.isMobileDevice();
    
    function debuggerCheck(limit) {
        if (!isMobile) {
            if (isNaN(+limit)) {
                limit = 100;
            }
            var startTime = +new Date();
            debugger; // Pause trigger
            var endTime = +new Date();
            
            if (isNaN(startTime) || isNaN(endTime) || endTime - startTime > limit) {
                common.devtoolLog('3');
            }
        }
    }

    if (window.attachEvent) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            debuggerCheck();
            window.attachEvent('onresize', debuggerCheck);
        } else {
            setTimeout(function() {
                debuggerCheck();
            }, 50);
        }
    } else {
        window.addEventListener('load', () => debuggerCheck());
        window.addEventListener('resize', () => debuggerCheck());
    }
}
