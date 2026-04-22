(function(){
    const existingPanel = document.getElementById('qa-bookmarklet-panel');
    if(existingPanel) {
        existingPanel.remove();
        document.querySelectorAll('.qa-error-mark').forEach(el => {
            el.style.outline = '';
            el.classList.remove('qa-error-mark');
        });
    }
    const existingTooltip = document.getElementById('qa-omni-tooltip');
    if(existingTooltip) existingTooltip.remove();

    // 검사 대상 영역 존재 여부 확인
    const targetWrappers = document.querySelectorAll('.sec_project_wrap');
    if (targetWrappers.length === 0) {
        alert('검사 대상 영역이 페이지에 존재하지 않습니다.');
        return;
    }

    let errors = [];
    const ignoreSelectors = ['#header__navi', '.btn-gotop', '.swiper-slide-duplicate', '.slick-cloned'];
    const ignoreQuery = ignoreSelectors.join(',');

    let requiredOmniPrefix = '';
    let isSamsungDotCom = false;
    
    // 타이틀 탐색 범위도 제한
    const headerTitleEl = document.querySelector('.sec_project_wrap h3.pt_header__title');
    if (headerTitleEl) {
        const titleText = headerTitleEl.innerText;
        if (titleText.includes('삼성닷컴')) {
            requiredOmniPrefix = 'sec:';
            isSamsungDotCom = true;
        } else if (titleText.includes('갤럭시 캠퍼스')) {
            requiredOmniPrefix = 'event:galaxycampus:';
        }
    }

    const tooltip = document.createElement('div');
    tooltip.id = 'qa-omni-tooltip';
    tooltip.style.cssText = `
        position: absolute; display: none; color: #fff; font-size: 15px; font-weight: 700;
        font-family: sans-serif; padding: 10px 14px; border-radius: 8px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2);
        text-shadow: 0 1px 2px rgba(0,0,0,0.5); z-index: 999999; pointer-events: none; white-space: nowrap;
    `;
    document.body.appendChild(tooltip);

    const addError = (el, type, msg, textPreview) => {
        let identifier = '';
        if (el.tagName === 'IMG') {
            let rawSrc = el.getAttribute('data-src') || el.getAttribute('src') || el.src || '';
            identifier = rawSrc.split('/').pop().split('?')[0] || '이미지';
            identifier = identifier.replace(/_pc|_mo/gi, ''); 
        } else if (el.tagName === 'A') {
            let rawHref = el.getAttribute('href') || el.href || '';
            identifier = rawHref.split('/').pop().split('?')[0] || el.innerText.trim().substring(0, 15);
        } else {
            identifier = el.innerText.trim().substring(0, 15) || el.className;
        }

        let signature = `${type}_${msg}_${identifier}`;
        
        let existing = errors.find(e => e.signature === signature);
        if (!existing) {
            errors.push({ signature: signature, el: el, type: type, msg: msg, text: textPreview || identifier });
        }

        el.classList.add('qa-error-mark'); 
        el.style.outline = '3px dashed red';
        el.style.outlineOffset = '-3px';
    };

    const bindTooltip = (el, hasValue, displayValue, typeLabel, colorSuccess, colorFail) => {
        el.addEventListener('mouseenter', () => {
            tooltip.style.backgroundColor = hasValue ? colorSuccess : colorFail; 
            tooltip.innerHTML = `${hasValue ? '✅' : '⚠️'} [${typeLabel}] ${displayValue}`;
            tooltip.style.visibility = 'hidden';
            tooltip.style.display = 'block';
            
            let rect = el.getBoundingClientRect();
            let ttRect = tooltip.getBoundingClientRect();
            let topPos = window.scrollY + rect.top - ttRect.height - 10;
            let leftPos = window.scrollX + rect.left;

            if (rect.top - ttRect.height - 10 < 0) { topPos = window.scrollY + rect.bottom + 10; }
            if (rect.left + ttRect.width > window.innerWidth) { leftPos = window.scrollX + window.innerWidth - ttRect.width - 20; }
            if (leftPos < window.scrollX) { leftPos = window.scrollX + 10; }

            tooltip.style.top = topPos + 'px';
            tooltip.style.left = leftPos + 'px';
            tooltip.style.visibility = 'visible';
        });
        el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    };

    const checkElement = (el, type) => {
        if (el.closest(ignoreQuery)) return; 

        if (type === 'IMG') {
            let altValue = el.getAttribute('alt');
            let hasValue = altValue && altValue.trim() !== '';
            let rawSrc = el.getAttribute('data-src') || el.getAttribute('src') || el.src || '';
            let filename = rawSrc.split('/').pop().split('?')[0] || '이미지';

            if (!hasValue && !el.hasAttribute('alt')) addError(el, 'IMG', 'alt 속성 누락', filename);
            else if (!hasValue) addError(el, 'IMG', 'alt 빈 값', filename);
            bindTooltip(el, hasValue, hasValue ? altValue : '값 없음', 'ALT', '#009432', '#e55039');
        } 
        else if (type === 'A' || type === 'BUTTON') {
            if (type === 'A' && (!el.hasAttribute('title') || el.getAttribute('title').trim() === '')) {
                addError(el, 'A', 'title 누락/빈 값', el.innerText.substring(0, 20));
            }
            let omniValue = el.getAttribute('data-omni');
            let hasValue = omniValue && omniValue.trim() !== '';
            
            if (hasValue && requiredOmniPrefix && !omniValue.startsWith(requiredOmniPrefix)) {
                addError(el, 'OMNI', `접두어 오류 (필수: ${requiredOmniPrefix})`, el.innerText.substring(0, 20));
            }
            bindTooltip(el, hasValue, hasValue ? omniValue : '값 없음', 'OMNI', '#1e3799', '#e55039');
        }
    };

    // 일반 마크업 검수 범위 제한
    document.querySelectorAll('.sec_project_wrap img').forEach(el => checkElement(el, 'IMG'));
    document.querySelectorAll('.sec_project_wrap a').forEach(el => checkElement(el, 'A'));
    document.querySelectorAll('.sec_project_wrap button').forEach(el => checkElement(el, 'BUTTON'));

    // 크롤링 검수 범위 제한
    if (isSamsungDotCom) {
        document.querySelectorAll('.sec_project_wrap .pt_slide--banner .swiper-wrapper > li').forEach(li => {
            if (li.closest(ignoreQuery)) return;
            if (li.getAttribute('data-crawling-type') !== 'event-banner') {
                addError(li, 'CRAWL', 'type="event-banner" 오류/누락', '배너 영역');
            }
        });

        const textDateRegex = /^\d{4}\.\d{2}\.\d{2}$/; 
        const attrDateRegex = /^\d{2}\/\d{2}\/\d{4}$/; 

        document.querySelectorAll('.sec_project_wrap .pt_header__date').forEach(dateWrap => {
            if (dateWrap.closest(ignoreQuery)) return;
            const spans = dateWrap.querySelectorAll('span');
            
            if (spans.length >= 1) {
                const startSpan = spans[0];
                const startVal = startSpan.getAttribute('data-start-date');
                const startText = startSpan.innerText.trim();
                
                if (!startVal) addError(startSpan, 'CRAWL', 'data-start-date 속성 누락', startText || '시작일');
                else if (!textDateRegex.test(startText)) addError(startSpan, 'CRAWL', '화면 텍스트 날짜 형식 오류 (YYYY.MM.DD 요망)', startText);
                else if (!attrDateRegex.test(startVal)) addError(startSpan, 'CRAWL', 'data-start-date 속성 형식 오류 (DD/MM/YYYY 요망)', startVal);
                else {
                    const [y, m, d] = startText.split('.');
                    if (startVal !== `${d}/${m}/${y}`) addError(startSpan, 'CRAWL', `data-start-date 불일치 (기대값: ${d}/${m}/${y})`, startVal);
                }
            }
            if (spans.length >= 2) {
                const endSpan = spans[1];
                const endVal = endSpan.getAttribute('data-end-date');
                const endText = endSpan.innerText.trim();
                
                if (!endVal) addError(endSpan, 'CRAWL', 'data-end-date 속성 누락', endText || '종료일');
                else if (!textDateRegex.test(endText)) addError(endSpan, 'CRAWL', '화면 텍스트 날짜 형식 오류 (YYYY.MM.DD 요망)', endText);
                else if (!attrDateRegex.test(endVal)) addError(endSpan, 'CRAWL', 'data-end-date 속성 형식 오류 (DD/MM/YYYY 요망)', endVal);
                else {
                    const [y, m, d] = endText.split('.');
                    if (endVal !== `${d}/${m}/${y}`) addError(endSpan, 'CRAWL', `data-end-date 불일치 (기대값: ${d}/${m}/${y})`, endVal);
                }
            }
        });

        document.querySelectorAll('.sec_project_wrap .pt_bnf__box').forEach(box => {
            if (box.closest(ignoreQuery)) return;
            const ul = box.querySelector('ul.pt_bnf__list');
            if (ul) {
                let ulMsgs = [];
                if (!ul.hasAttribute('data-category-name') || ul.getAttribute('data-category-name').trim() === '') ulMsgs.push('data-category-name 누락/빈 값');
                if (ulMsgs.length > 0) addError(ul, 'CRAWL', ulMsgs.join(', '), '혜택 탭 영역');

                ul.querySelectorAll('li').forEach(li => {
                    if (li.closest(ignoreQuery)) return;
                    
                    li.querySelectorAll('.pt_bnf__eyebrow').forEach(el => {
                        if (el.getAttribute('data-crawling-type') !== 'eyebrow') addError(el, 'CRAWL', 'type="eyebrow" 누락/오류', el.innerText.substring(0,15));
                    });
                    li.querySelectorAll('.pt_bnf__title').forEach(el => {
                        if (el.getAttribute('data-crawling-type') !== 'head-title') addError(el, 'CRAWL', 'type="head-title" 누락/오류', el.innerText.substring(0,15));
                    });
                    li.querySelectorAll('.pt_bnf__disc').forEach(el => {
                        if (el.getAttribute('data-crawling-type') !== 'middle-disc') addError(el, 'CRAWL', 'type="middle-disc" 누락/오류', el.innerText.substring(0,15));
                    });
                    
                    const imgs = li.querySelectorAll('img');
                    if (imgs.length > 0) {
                        const hasIconImg = Array.from(imgs).some(img => img.getAttribute('data-crawling-type') === 'icon-img');
                        if (!hasIconImg) {
                            let targetImg = Array.from(imgs).find(img => img.offsetParent !== null) || imgs[0];
                            let rawSrc = targetImg.getAttribute('data-src') || targetImg.getAttribute('src') || targetImg.src || '';
                            let filename = rawSrc.split('/').pop().split('?')[0] || '아이콘 이미지';
                            let baseFilename = filename.replace(/_pc|_mo/gi, ''); 
                            addError(targetImg, 'CRAWL', 'type="icon-img" 누락/오류', baseFilename);
                        }
                    }
                });
            } else {
                if (box.hasAttribute('data-category-name')) {
                    addError(box, 'CRAWL', 'ul.pt_bnf__list 없음 (data-category-name 삭제 필요)', '혜택 박스 영역');
                }
            }
        });
    }

    if(errors.length === 0) {
        alert('발견된 마크업 오류가 없습니다.');
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'qa-bookmarklet-panel';
    Object.assign(panel.style, {
        position: 'fixed', top: '15px', right: '15px', width: '320px', 
        backgroundColor: '#fff', border: '1px solid #ccc',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '999998', padding: '15px',
        fontFamily: 'sans-serif', fontSize: '13px', color: '#333'
    });

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;';
    header.innerHTML = `<strong style="font-size:14px;color:#d32f2f;">QA 결과 (${errors.length}건)</strong>`;
    
    const btnGroup = document.createElement('div');
    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = '최소화';
    toggleBtn.style.cssText = 'background:#f0f0f0; border:1px solid #ccc; cursor:pointer; padding:2px 8px; font-size:12px; margin-right:5px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '종료';
    closeBtn.style.cssText = 'background:#ffecec; border:1px solid #ffbaba; color:#d32f2f; cursor:pointer; padding:2px 8px; font-size:12px;';

    btnGroup.appendChild(toggleBtn);
    btnGroup.appendChild(closeBtn);
    header.appendChild(btnGroup);
    panel.appendChild(header);

    const listWrapper = document.createElement('div');
    listWrapper.style.cssText = 'max-height: 60vh; overflow-y: auto;';
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none; padding:0; margin:0;';

    errors.forEach((err) => {
        const li = document.createElement('li');
        li.style.cssText = 'border-bottom:1px solid #f5f5f5; padding:8px 0; cursor:pointer;';
        li.onmouseover = () => li.style.backgroundColor = '#f9f9f9';
        li.onmouseout = () => li.style.backgroundColor = 'transparent';

        li.onclick = () => {
            let scrollTarget = err.el;
            const swiperSlide = err.el.closest('.swiper-slide');
            
            if (swiperSlide) {
                scrollTarget = err.el.closest('.swiper, .swiper-container') || swiperSlide.parentNode;
                const swiperInstanceEl = err.el.closest('.swiper, .swiper-container');
                if (swiperInstanceEl && swiperInstanceEl.swiper) {
                    const slides = Array.from(swiperInstanceEl.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)'));
                    let originalSlide = slides.find(s => s.contains(err.el)) || swiperSlide;
                    let idx = slides.indexOf(originalSlide);
                    if(idx > -1) swiperInstanceEl.swiper.slideTo(idx);
                }
            }

            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const originalOutline = err.el.style.outline;
            err.el.style.outline = '4px solid blue';
            setTimeout(() => { err.el.style.outline = originalOutline; }, 1500);
        };

        const tagBadge = `<span style="display:inline-block;padding:2px 5px;background:#333;color:#fff;border-radius:3px;font-size:11px;margin-right:5px;">${err.type}</span>`;
        const textPreview = err.text ? `<div style="color:#666;font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${err.text}"</div>` : '';
        
        li.innerHTML = `${tagBadge} <span style="font-weight:bold;">${err.msg}</span> <br/>${textPreview}`;
        list.appendChild(li);
    });

    listWrapper.appendChild(list);
    panel.appendChild(listWrapper);
    document.body.appendChild(panel);

    let isMinimized = false;
    toggleBtn.onclick = function() {
        isMinimized = !isMinimized;
        listWrapper.style.display = isMinimized ? 'none' : 'block';
        toggleBtn.innerText = isMinimized ? '펼치기' : '최소화';
    };

    closeBtn.onclick = function() {
        panel.remove();
        document.querySelectorAll('.qa-error-mark').forEach(el => {
            el.style.outline = '';
            el.classList.remove('qa-error-mark');
        });
        const t = document.getElementById('qa-omni-tooltip');
        if(t) t.remove();
    };
})();
