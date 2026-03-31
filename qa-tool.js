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

    let errors = [];
    // 스와이퍼 복제본 완전 차단
    const ignoreSelectors = ['#header__navi', '.btn-gotop', '.swiper-slide-duplicate', '.slick-cloned'];
    const ignoreQuery = ignoreSelectors.join(',');

    let requiredOmniPrefix = '';
    let isSamsungDotCom = false;
    
    const headerTitleEl = document.querySelector('h3.pt_header__title');
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

    // 에러 추가 시 고유값(src, href 등)을 기준으로 자동 그룹화
    const addError = (el, type, msg, textPreview) => {
        let identifier = '';
        if (el.tagName === 'IMG') identifier = el.getAttribute('src') || el.src;
        else if (el.tagName === 'A') identifier = el.getAttribute('href') || el.href || el.innerText.trim().substring(0, 20);
        else identifier = el.innerText.trim().substring(0, 20) || el.className;
        
        // _pc, _mo 상관없이 중복 에러를 묶기 위한 시그니처
        let signature = `${type}_${msg}_${identifier}`;
        
        let existingGroup = errors.find(e => e.signature === signature);
        if (existingGroup) {
            if(!existingGroup.els.includes(el)) existingGroup.els.push(el);
        } else {
            errors.push({ signature: signature, els: [el], type: type, msg: msg, text: textPreview });
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
            if (!hasValue && !el.hasAttribute('alt')) addError(el, 'IMG', 'alt 속성 누락', '이미지');
            else if (!hasValue) addError(el, 'IMG', 'alt 빈 값', '이미지');
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

    document.querySelectorAll('img').forEach(el => checkElement(el, 'IMG'));
    document.querySelectorAll('a').forEach(el => checkElement(el, 'A'));
    document.querySelectorAll('button').forEach(el => checkElement(el, 'BUTTON'));

    // 크롤링 검수 실행 (삼성닷컴 조건)
    if (isSamsungDotCom) {
        document.querySelectorAll('.pt_slide--banner .swiper-wrapper > li').forEach(li => {
            if (li.closest(ignoreQuery)) return;
            if (li.getAttribute('data-crawling-type') !== 'event-banner') {
                addError(li, 'CRAWL', 'type="event-banner" 오류/누락', '배너 영역');
            }
        });

        const textDateRegex = /^\d{4}\.\d{2}\.\d{2}$/; 
        const attrDateRegex = /^\d{2}\/\d{2}\/\d{4}$/; 

        document.querySelectorAll('.pt_header__date').forEach(dateWrap => {
            if (dateWrap.closest(ignoreQuery)) return;
            const spans = dateWrap.querySelectorAll('span');
            // ... (기존 날짜 검증 로직 동일하게 유지)
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

        document.querySelectorAll('.pt_bnf__box').forEach(box => {
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
                    
                    // 핵심 수정: li 내부의 모든 이미지 수집 후 단 하나라도 조건 충족하면 정상 처리
                    const imgs = li.querySelectorAll('img');
                    if (imgs.length > 0) {
                        const hasIconImg = Array.from(imgs).some(img => img.getAttribute('data-crawling-type') === 'icon-img');
                        // 아무 이미지도 조건을 충족하지 못했을 경우 첫 번째 이미지(주로 PC용)를 대표로 에러 등록
                        if (!hasIconImg) {
                            addError(imgs[0], 'CRAWL', '이미지 type="icon-img" 누락/오류', '아이콘 이미지');
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

    // UI 렌더링
    const panel = document.createElement('div');
    panel.id = 'qa-bookmarklet-panel';
    Object.assign(panel.style, {
        position: 'fixed', top: '15px', right: '15px', width: '330px', 
        backgroundColor: '#fff', border: '1px solid #ccc',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '999998', padding: '15px',
        fontFamily: 'sans-serif', fontSize: '13px', color: '#333'
    });

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;';
    const totalEls = errors.reduce((acc, err) => acc + err.els.length, 0);
    header.innerHTML = `<strong style="font-size:14px;color:#d32f2f;">QA 결과 (유형 ${errors.length}건 / 총 ${totalEls}개)</strong>`;
    
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
            // 1. 현재 화면에 활성화된 스와이퍼 슬라이드 안의 에러를 최우선 타겟으로 설정
            let activeEl = err.els.find(el => {
                const slide = el.closest('.swiper-slide');
                return slide && slide.classList.contains('swiper-slide-active');
            });
            let targetEl = activeEl || err.els[0];
            
            let scrollTarget = targetEl;
            const swiperSlide = targetEl.closest('.swiper-slide');
            
            // 스와이퍼 API 연동
            if (swiperSlide) {
                scrollTarget = targetEl.closest('.swiper, .swiper-container') || swiperSlide.parentNode;
                const swiperInstanceEl = targetEl.closest('.swiper, .swiper-container');
                if (swiperInstanceEl && swiperInstanceEl.swiper) {
                    const realIndex = swiperSlide.getAttribute('data-swiper-slide-index');
                    if (realIndex !== null) {
                        swiperInstanceEl.swiper.slideToLoop(parseInt(realIndex));
                    } else {
                        const slides = Array.from(swiperSlide.parentNode.children).filter(el => el.classList.contains('swiper-slide') && !el.classList.contains('swiper-slide-duplicate'));
                        swiperInstanceEl.swiper.slideTo(slides.indexOf(swiperSlide));
                    }
                }
            }

            // 부드러운 스크롤 이동
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 현재 그룹에 속한 모든 에러 요소 하이라이팅 깜빡임
            err.els.forEach(el => {
                const originalOutline = el.style.outline;
                el.style.outline = '4px solid blue';
                setTimeout(() => { el.style.outline = originalOutline; }, 1500);
            });
        };

        const tagBadge = `<span style="display:inline-block;padding:2px 5px;background:#333;color:#fff;border-radius:3px;font-size:11px;margin-right:5px;">${err.type}</span>`;
        const textPreview = err.text ? `<div style="color:#666;font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${err.text}"</div>` : '';
        const countBadge = err.els.length > 1 ? `<span style="color:#ff9800;font-size:11px;margin-left:5px;">(${err.els.length}개 위치)</span>` : '';
        
        li.innerHTML = `${tagBadge} <span style="font-weight:bold;">${err.msg}</span> ${countBadge} ${textPreview}`;
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
