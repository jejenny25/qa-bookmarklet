(function(){
    const existingPanel = document.getElementById('qa-bookmarklet-panel');
    if(existingPanel) {
        existingPanel.remove();
        document.querySelectorAll('.qa-error-mark').forEach(el => {
            el.style.outline = '';
            el.classList.remove('qa-error-mark');
        });
    }

    let errors = [];

    // 예외 처리할 영역의 CSS 선택자 모음
    // 누락된 두 번째 영역은 이 배열 안에 콤마로 구분하여 추가하면 됩니다.
    const ignoreSelectors = [
        '#header__navi', 
        '.btn-gotop'
    ];
    const ignoreQuery = ignoreSelectors.join(',');

    const checkElement = (el, type) => {
        // 배열에 등록된 선택자 내부(또는 자신)에 속하면 검수 즉시 종료
        if (el.closest(ignoreQuery)) return; 

        let errorMsgs = [];
        if (type === 'IMG') {
            if (!el.hasAttribute('alt') || el.getAttribute('alt').trim() === '') errorMsgs.push('alt 누락/빈 값');
        } else if (type === 'A' || type === 'BUTTON') {
            if (el.getAttribute('data-omni-type') !== 'microsite') errorMsgs.push('type="microsite" 아님/누락');
            if (!el.hasAttribute('data-omni') || el.getAttribute('data-omni').trim() === '') errorMsgs.push('data-omni 누락/빈 값');
            if (type === 'A' && (!el.hasAttribute('title') || el.getAttribute('title').trim() === '')) errorMsgs.push('title 누락/빈 값');
        }

        if (errorMsgs.length > 0) {
            errors.push({ el: el, type: type, msg: errorMsgs.join(', '), text: type === 'IMG' ? '이미지' : el.innerText.substring(0, 20) });
            el.classList.add('qa-error-mark'); 
            el.style.outline = '3px dashed red';
            el.style.outlineOffset = '-3px';
        }
    };

    document.querySelectorAll('img').forEach(el => checkElement(el, 'IMG'));
    document.querySelectorAll('a').forEach(el => checkElement(el, 'A'));
    document.querySelectorAll('button').forEach(el => checkElement(el, 'BUTTON'));

    if(errors.length === 0) {
        alert('발견된 마크업 오류가 없습니다.');
        return;
    }

    // 플로팅 패널 생성
    const panel = document.createElement('div');
    panel.id = 'qa-bookmarklet-panel';
    Object.assign(panel.style, {
        position: 'fixed', top: '15px', right: '15px', width: '320px', 
        backgroundColor: '#fff', border: '1px solid #ccc',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '999999', padding: '15px',
        fontFamily: 'sans-serif', fontSize: '13px', color: '#333'
    });

    // 헤더 및 토글/종료 버튼
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

    // 에러 리스트 영역
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
            err.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const originalOutline = err.el.style.outline;
            err.el.style.outline = '4px solid blue';
            setTimeout(() => { err.el.style.outline = originalOutline; }, 1500);
        };

        const tagBadge = `<span style="display:inline-block;padding:2px 5px;background:#333;color:#fff;border-radius:3px;font-size:11px;margin-right:5px;">${err.type}</span>`;
        const textPreview = err.text ? `<div style="color:#666;font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${err.text}"</div>` : '';
        
        li.innerHTML = `${tagBadge} <span style="font-weight:bold;">${err.msg}</span> ${textPreview}`;
        list.appendChild(li);
    });

    listWrapper.appendChild(list);
    panel.appendChild(listWrapper);
    document.body.appendChild(panel);

    // 버튼 동작 바인딩
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
    };
})();
