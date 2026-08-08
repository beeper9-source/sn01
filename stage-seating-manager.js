/**
 * stage-seating-manager.js
 * 분당파밀리에앙상블 연주자 좌석 배치도 매니저
 */

class StageSeatingManager {
    constructor() {
        this.storageKey = 'pamilie_stage_seating_presets_v1';
        this.currentPresetIdKey = 'pamilie_stage_seating_active_id';
        
        // 악기별 기본 테마 컬러 (어두운 배경 및 밝은 배경 모두 가독성 좋은 색상)
        this.instrumentColors = {
            '바이올린': { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1', badge: '#0284c7' },
            '제1바이올린': { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1', badge: '#0284c7' },
            '제2바이올린': { bg: '#bae6fd', border: '#0369a1', text: '#075985', badge: '#0369a1' },
            '비올라': { bg: '#fef3c7', border: '#d97706', text: '#b45309', badge: '#d97706' },
            '첼로': { bg: '#dcfce7', border: '#16a34a', text: '#15803d', badge: '#16a34a' },
            '콘트라베이스': { bg: '#d1fae5', border: '#059669', text: '#047857', badge: '#059669' },
            '플루트': { bg: '#fce7f3', border: '#db2777', text: '#be185d', badge: '#db2777' },
            '클라리넷': { bg: '#ede9fe', border: '#7c3aed', text: '#6d28d9', badge: '#7c3aed' },
            '오보에': { bg: '#ffedd5', border: '#ea580c', text: '#c2410c', badge: '#ea580c' },
            '바순': { bg: '#fef9c3', border: '#ca8a04', text: '#a16207', badge: '#ca8a04' },
            '피아노': { bg: '#f1f5f9', border: '#475569', text: '#334155', badge: '#475569' },
            '기타': { bg: '#f3e8ff', border: '#9333ea', text: '#7e22ce', badge: '#9333ea' },
            '객원': { bg: '#fee2e2', border: '#dc2626', text: '#b91c1c', badge: '#dc2626' }
        };

        this.presets = [];
        this.currentPreset = null;
        this.draggedData = null; // { source: 'sidebar'|'seat', memberNo, seatId, ... }
        this.selectedSeat = null;

        this.init();
    }

    init() {
        this.loadPresets();
        this.bindEvents();
    }

    // 기본 프리셋 생성
    createDefaultPreset(name = '정기연주회 기본배치', type = 'arc') {
        const id = 'preset_' + Date.now();
        if (type === 'arc') {
            return {
                id,
                name,
                type: 'arc',
                conductor: { show: true, name: '지휘자' },
                rows: [
                    { id: 'row_1', label: '1열 (앞)', seatCount: 6, radius: 170, spanAngle: 110, seats: this.generateEmptySeats(6) },
                    { id: 'row_2', label: '2열 (중간)', seatCount: 10, radius: 270, spanAngle: 130, seats: this.generateEmptySeats(10) },
                    { id: 'row_3', label: '3열 (뒤)', seatCount: 12, radius: 370, spanAngle: 145, seats: this.generateEmptySeats(12) }
                ]
            };
        } else {
            return {
                id,
                name,
                type: 'grid',
                conductor: { show: true, name: '지휘자' },
                rows: [
                    { id: 'row_1', label: '1열 (앞)', seatCount: 6, seats: this.generateEmptySeats(6) },
                    { id: 'row_2', label: '2열 (중간)', seatCount: 8, seats: this.generateEmptySeats(8) },
                    { id: 'row_3', label: '3열 (뒤)', seatCount: 8, seats: this.generateEmptySeats(8) }
                ]
            };
        }
    }

    generateEmptySeats(count) {
        const seats = [];
        for (let i = 1; i <= count; i++) {
            seats.push({
                id: 'seat_' + Math.random().toString(36).substr(2, 9),
                seatNum: i,
                memberNo: null,
                customName: '',
                instrument: ''
            });
        }
        return seats;
    }

    loadPresets() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                this.presets = JSON.parse(raw);
            }
        } catch (e) {
            console.error('좌석 프리셋 로드 실패:', e);
            this.presets = [];
        }

        if (!this.presets || this.presets.length === 0) {
            const def = this.createDefaultPreset('정기연주회 부채꼴 배치', 'arc');
            const defGrid = this.createDefaultPreset('합주실 격자 배치', 'grid');
            this.presets = [def, defGrid];
            this.savePresets();
        }

        const activeId = localStorage.getItem(this.currentPresetIdKey);
        this.currentPreset = this.presets.find(p => p.id === activeId) || this.presets[0];
    }

    savePresets() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.presets));
            if (this.currentPreset) {
                localStorage.setItem(this.currentPresetIdKey, this.currentPreset.id);
            }
        } catch (e) {
            console.error('좌석 프리셋 저장 실패:', e);
        }
    }

    bindEvents() {
        // 모달 열기 버튼
        const openBtn = document.getElementById('seatingChartBtn');
        const modal = document.getElementById('seatingChartModal');
        const closeBtn = document.getElementById('closeSeatingChartBtn');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // 모달 바깥 클릭 시 닫기
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    openModal() {
        const modal = document.getElementById('seatingChartModal');
        if (!modal) return;

        modal.style.display = 'flex';
        modal.classList.add('active');
        this.renderPresetSelector();
        this.renderControls();
        this.renderMembersSidebar();
        this.renderStage();
    }

    closeModal() {
        const modal = document.getElementById('seatingChartModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
        this.closeSeatDetailModal();
    }

    // 프리셋 드롭다운 렌더링
    renderPresetSelector() {
        const select = document.getElementById('stagePresetSelect');
        if (!select) return;

        select.innerHTML = '';
        this.presets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.type === 'arc' ? '부채꼴' : '격자'})`;
            if (this.currentPreset && p.id === this.currentPreset.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            const found = this.presets.find(p => p.id === e.target.value);
            if (found) {
                this.currentPreset = found;
                this.savePresets();
                this.renderControls();
                this.renderMembersSidebar();
                this.renderStage();
            }
        };
    }

    // 컨트롤 패널(버튼, 옵션) 렌더링
    renderControls() {
        const typeSelect = document.getElementById('stageTypeSelect');
        if (typeSelect && this.currentPreset) {
            typeSelect.value = this.currentPreset.type;
            typeSelect.onchange = (e) => {
                this.currentPreset.type = e.target.value;
                this.savePresets();
                this.renderPresetSelector();
                this.renderStage();
            };
        }

        const presetNameInput = document.getElementById('stagePresetNameInput');
        if (presetNameInput && this.currentPreset) {
            presetNameInput.value = this.currentPreset.name;
            presetNameInput.onchange = (e) => {
                const newName = e.target.value.trim();
                if (newName) {
                    this.currentPreset.name = newName;
                    this.savePresets();
                    this.renderPresetSelector();
                }
            };
        }
    }

    // 단원 사이드바 렌더링
    renderMembersSidebar() {
        const sidebar = document.getElementById('stageMembersList');
        const assignedStats = document.getElementById('stageAssignedStats');
        if (!sidebar) return;

        sidebar.innerHTML = '';

        // 글로벌 members 데이터 가져오기
        const allMembers = (typeof window.members !== 'undefined' && Array.isArray(window.members)) 
            ? window.members.filter(m => m.isActive !== false)
            : [];

        // 현재 배치된 단원 번호 목록
        const assignedMemberNos = new Set();
        if (this.currentPreset && this.currentPreset.rows) {
            this.currentPreset.rows.forEach(row => {
                row.seats.forEach(seat => {
                    if (seat.memberNo) assignedMemberNos.add(Number(seat.memberNo));
                });
            });
        }

        // 악기별 그룹핑
        const grouped = {};
        allMembers.forEach(m => {
            const inst = m.instrument || '기타';
            if (!grouped[inst]) grouped[inst] = [];
            grouped[inst].push(m);
        });

        const totalSeats = this.getTotalSeatsCount();
        const assignedCount = assignedMemberNos.size;

        if (assignedStats) {
            assignedStats.innerHTML = `총 좌석 <strong>${totalSeats}석</strong> | 배정 <strong>${assignedCount}명</strong> (미배정 ${Math.max(0, allMembers.length - assignedCount)}명)`;
        }

        if (allMembers.length === 0) {
            sidebar.innerHTML = '<div class="stage-empty-msg">등록된 단원이 없습니다.</div>';
            return;
        }

        Object.keys(grouped).forEach(inst => {
            const groupWrap = document.createElement('div');
            groupWrap.className = 'stage-inst-group';

            const colorTheme = this.getInstrumentColor(inst);
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'stage-inst-header';
            groupHeader.style.borderLeftColor = colorTheme.border;
            groupHeader.innerHTML = `
                <span class="inst-name">${inst}</span>
                <span class="inst-count">(${grouped[inst].filter(m => assignedMemberNos.has(Number(m.no))).length}/${grouped[inst].length})</span>
            `;
            groupWrap.appendChild(groupHeader);

            const memberList = document.createElement('div');
            memberList.className = 'stage-inst-members';

            grouped[inst].forEach(member => {
                const isAssigned = assignedMemberNos.has(Number(member.no));
                const item = document.createElement('div');
                item.className = `stage-member-card ${isAssigned ? 'assigned' : 'unassigned'}`;
                item.draggable = true;
                item.dataset.memberNo = member.no;
                item.dataset.memberName = member.name;
                item.dataset.instrument = member.instrument;

                item.innerHTML = `
                    <span class="member-badge" style="background:${colorTheme.badge}; color:white;">${inst.slice(0, 2)}</span>
                    <span class="member-name">${member.name}</span>
                    <span class="member-status">${isAssigned ? '✓ 배치됨' : '미배치'}</span>
                `;

                // 드래그 시작 이벤트
                item.addEventListener('dragstart', (e) => {
                    this.draggedData = {
                        source: 'sidebar',
                        memberNo: Number(member.no),
                        memberName: member.name,
                        instrument: member.instrument
                    };
                    item.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    this.draggedData = null;
                });

                // 클릭 시 바로 첫 번째 빈 좌석에 배정
                item.addEventListener('click', () => {
                    if (!isAssigned) {
                        this.assignMemberToFirstEmptySeat(member);
                    } else {
                        // 이미 배정된 경우 해당 좌석으로 스크롤/포커스
                        this.highlightMemberSeat(member.no);
                    }
                });

                memberList.appendChild(item);
            });

            groupWrap.appendChild(memberList);
            sidebar.appendChild(groupWrap);
        });
    }

    getTotalSeatsCount() {
        if (!this.currentPreset || !this.currentPreset.rows) return 0;
        return this.currentPreset.rows.reduce((sum, r) => sum + (r.seats ? r.seats.length : 0), 0);
    }

    getInstrumentColor(instrument) {
        if (!instrument) return { bg: '#f8fafc', border: '#cbd5e1', text: '#475569', badge: '#64748b' };
        for (const key of Object.keys(this.instrumentColors)) {
            if (instrument.includes(key) || key.includes(instrument)) {
                return this.instrumentColors[key];
            }
        }
        return { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce', badge: '#9333ea' };
    }

    // 첫 번째 빈 좌석에 자동 배정
    assignMemberToFirstEmptySeat(member) {
        if (!this.currentPreset) return;
        for (const row of this.currentPreset.rows) {
            for (const seat of row.seats) {
                if (!seat.memberNo && !seat.customName) {
                    seat.memberNo = Number(member.no);
                    seat.instrument = member.instrument;
                    this.savePresets();
                    this.renderMembersSidebar();
                    this.renderStage();
                    return;
                }
            }
        }
        alert('모든 좌석이 찼습니다. 열을 추가하거나 좌석 수를 늘려주세요.');
    }

    // 좌석 하이라이트
    highlightMemberSeat(memberNo) {
        const el = document.querySelector(`.stage-seat[data-member-no="${memberNo}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            el.classList.add('pulse-highlight');
            setTimeout(() => el.classList.remove('pulse-highlight'), 1600);
        }
    }

    // 무대 렌더링
    renderStage() {
        const stageContainer = document.getElementById('stageVisualArea');
        if (!stageContainer || !this.currentPreset) return;

        stageContainer.innerHTML = '';

        const type = this.currentPreset.type || 'arc';

        const stageWrapper = document.createElement('div');
        stageWrapper.className = `stage-canvas stage-${type}-mode`;

        // 상단 무대 뒤쪽 가이드 (Backstage)
        const backstage = document.createElement('div');
        backstage.className = 'stage-backdrop-indicator';
        backstage.innerHTML = '<span>무대 뒤쪽 (Backstage / 악단 뒤편)</span>';
        stageWrapper.appendChild(backstage);

        // 중앙 좌석 영역
        const seatingArea = document.createElement('div');
        seatingArea.className = 'stage-seating-area';

        if (type === 'arc') {
            this.renderArcSeats(seatingArea);
        } else {
            this.renderGridSeats(seatingArea);
        }

        stageWrapper.appendChild(seatingArea);

        // 지휘자 단상 (Conductor Podium) & 객석 방향 표시 (앞쪽)
        const conductorPodium = document.createElement('div');
        conductorPodium.className = 'stage-conductor-podium';
        conductorPodium.innerHTML = `
            <div class="podium-box">
                <span class="podium-icon">🎼</span>
                <span class="podium-text">${this.currentPreset.conductor?.name || '지휘자'}</span>
            </div>
            <div class="audience-direction">
                <span>▼ 객석 방향 (Audience) ▼</span>
            </div>
        `;
        stageWrapper.appendChild(conductorPodium);

        stageContainer.appendChild(stageWrapper);
    }

    // 부채꼴 (Arc) 좌석 렌더링
    renderArcSeats(container) {
        const rows = this.currentPreset.rows || [];
        const stageWidth = 960;
        const stageHeight = 620;
        const centerX = stageWidth / 2;
        const centerY = 540; // 지휘자 위치 기준점 (아래쪽 중심)

        const svgWrapper = document.createElement('div');
        svgWrapper.className = 'stage-arc-wrapper';
        svgWrapper.style.width = `${stageWidth}px`;
        svgWrapper.style.height = `${stageHeight}px`;

        // 배경 가이드 라인(원호) 그리기용 SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'stage-arc-svg');
        svg.setAttribute('viewBox', `0 0 ${stageWidth} ${stageHeight}`);

        rows.forEach((row, rowIndex) => {
            const count = row.seats.length;
            const radius = row.radius || (170 + rowIndex * 95);
            const spanAngle = row.spanAngle || (105 + rowIndex * 15); // 각도 범위 (도)
            const startAngle = -spanAngle / 2;
            const angleStep = count > 1 ? spanAngle / (count - 1) : 0;

            // 원호 가이드선 SVG 경로
            const startRad = ((-90 + startAngle - 5) * Math.PI) / 180;
            const endRad = ((-90 + (spanAngle / 2) + 5) * Math.PI) / 180;
            const sx = centerX + radius * Math.cos(startRad);
            const sy = centerY + radius * Math.sin(startRad);
            const ex = centerX + radius * Math.cos(endRad);
            const ey = centerY + radius * Math.sin(endRad);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`);
            path.setAttribute('class', 'stage-arc-row-line');
            svg.appendChild(path);

            // 열 라벨 (좌측/우측)
            const labelRad = ((-90 + startAngle - 14) * Math.PI) / 180;
            const lx = centerX + radius * Math.cos(labelRad);
            const ly = centerY + radius * Math.sin(labelRad);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lx);
            text.setAttribute('y', ly);
            text.setAttribute('class', 'stage-arc-row-label');
            text.textContent = row.label || `${rowIndex + 1}열`;
            svg.appendChild(text);

            // 각 좌석 DOM 생성
            row.seats.forEach((seat, seatIndex) => {
                const currentAngle = count > 1 ? (startAngle + angleStep * seatIndex) : 0;
                const rad = ((-90 + currentAngle) * Math.PI) / 180;

                const posX = centerX + radius * Math.cos(rad);
                const posY = centerY + radius * Math.sin(rad);

                const seatEl = this.createSeatElement(seat, rowIndex, seatIndex, currentAngle);
                seatEl.style.left = `${posX}px`;
                seatEl.style.top = `${posY}px`;
                svgWrapper.appendChild(seatEl);
            });
        });

        svgWrapper.appendChild(svg);
        container.appendChild(svgWrapper);
    }

    // 격자 (Grid) 좌석 렌더링
    renderGridSeats(container) {
        const rows = this.currentPreset.rows || [];
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'stage-grid-wrapper';

        // 역순(뒤쪽 열이 위로 오도록) 렌더링
        for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
            const row = rows[rowIndex];
            const rowDiv = document.createElement('div');
            rowDiv.className = 'stage-grid-row';

            const rowHeader = document.createElement('div');
            rowHeader.className = 'stage-grid-row-header';
            rowHeader.innerHTML = `
                <span class="row-badge">${row.label || `${rowIndex + 1}열`}</span>
                <span class="row-count">(${row.seats.length}석)</span>
            `;
            rowDiv.appendChild(rowHeader);

            const seatsList = document.createElement('div');
            seatsList.className = 'stage-grid-seats-list';

            row.seats.forEach((seat, seatIndex) => {
                const seatEl = this.createSeatElement(seat, rowIndex, seatIndex, 0);
                seatsList.appendChild(seatEl);
            });

            rowDiv.appendChild(seatsList);
            gridWrapper.appendChild(rowDiv);
        }

        container.appendChild(gridWrapper);
    }

    // 개별 좌석 엘리먼트 생성
    createSeatElement(seat, rowIndex, seatIndex, rotateAngle = 0) {
        const seatEl = document.createElement('div');
        seatEl.className = 'stage-seat';
        seatEl.id = `seat_${seat.id}`;
        seatEl.dataset.seatId = seat.id;
        seatEl.dataset.rowIndex = rowIndex;
        seatEl.dataset.seatIndex = seatIndex;
        seatEl.style.transform = `translate(-50%, -50%) rotate(${rotateAngle}deg)`;

        // 단원 정보 조회
        let memberName = seat.customName || '';
        let instrument = seat.instrument || '';
        let memberNo = seat.memberNo;

        if (memberNo && typeof window.members !== 'undefined') {
            const found = window.members.find(m => Number(m.no) === Number(memberNo));
            if (found) {
                memberName = found.name;
                instrument = found.instrument || instrument;
                seatEl.dataset.memberNo = found.no;
            }
        }

        const isOccupied = !!(memberName || memberNo);
        const theme = isOccupied ? this.getInstrumentColor(instrument) : null;

        if (isOccupied) {
            seatEl.classList.add('occupied');
            seatEl.style.backgroundColor = theme.bg;
            seatEl.style.borderColor = theme.border;
            seatEl.style.color = theme.text;
        } else {
            seatEl.classList.add('empty');
        }

        seatEl.innerHTML = `
            <div class="seat-chair-icon" style="transform: rotate(${-rotateAngle}deg);">🪑</div>
            <div class="seat-content" style="transform: rotate(${-rotateAngle}deg);">
                <div class="seat-num">${seatIndex + 1}</div>
                <div class="seat-member-name" title="${memberName || '빈 좌석'}">${memberName || '빈 좌석'}</div>
                <div class="seat-inst-tag" style="background:${isOccupied ? theme.badge : '#94a3b8'};">${instrument || '-'}</div>
            </div>
        `;

        // 좌석 드래그 (자리 이동/교환용)
        if (isOccupied) {
            seatEl.draggable = true;
            seatEl.addEventListener('dragstart', (e) => {
                this.draggedData = {
                    source: 'seat',
                    rowIndex,
                    seatIndex,
                    seatId: seat.id,
                    memberNo: seat.memberNo,
                    customName: seat.customName,
                    instrument: seat.instrument
                };
                seatEl.classList.add('seat-dragging');
                e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
            });

            seatEl.addEventListener('dragend', () => {
                seatEl.classList.remove('seat-dragging');
                this.draggedData = null;
            });
        }

        // 드롭존 이벤트
        seatEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            seatEl.classList.add('drag-hover');
        });

        seatEl.addEventListener('dragleave', () => {
            seatEl.classList.remove('drag-hover');
        });

        seatEl.addEventListener('drop', (e) => {
            e.preventDefault();
            seatEl.classList.remove('drag-hover');
            this.handleSeatDrop(rowIndex, seatIndex);
        });

        // 클릭 시 좌석 상세/배정 모달 열기
        seatEl.addEventListener('click', () => {
            this.openSeatDetailModal(rowIndex, seatIndex, seat);
        });

        return seatEl;
    }

    // 좌석에 드롭 처리
    handleSeatDrop(targetRowIndex, targetSeatIndex) {
        if (!this.draggedData || !this.currentPreset) return;

        const targetSeat = this.currentPreset.rows[targetRowIndex].seats[targetSeatIndex];

        if (this.draggedData.source === 'sidebar') {
            // 사이드바에서 드래그: 기존에 이 단원이 다른 좌석에 있었다면 그 좌석을 비움
            this.clearMemberFromAllSeats(this.draggedData.memberNo);

            targetSeat.memberNo = this.draggedData.memberNo;
            targetSeat.customName = '';
            targetSeat.instrument = this.draggedData.instrument;
        } else if (this.draggedData.source === 'seat') {
            // 좌석 간 이동/맞바꾸기(Swap)
            const srcRowIndex = this.draggedData.rowIndex;
            const srcSeatIndex = this.draggedData.seatIndex;
            const srcSeat = this.currentPreset.rows[srcRowIndex].seats[srcSeatIndex];

            // Swap
            const tempMemberNo = targetSeat.memberNo;
            const tempCustom = targetSeat.customName;
            const tempInst = targetSeat.instrument;

            targetSeat.memberNo = srcSeat.memberNo;
            targetSeat.customName = srcSeat.customName;
            targetSeat.instrument = srcSeat.instrument;

            srcSeat.memberNo = tempMemberNo;
            srcSeat.customName = tempCustom;
            srcSeat.instrument = tempInst;
        }

        this.savePresets();
        this.renderMembersSidebar();
        this.renderStage();
    }

    clearMemberFromAllSeats(memberNo) {
        if (!this.currentPreset || !memberNo) return;
        this.currentPreset.rows.forEach(r => {
            r.seats.forEach(s => {
                if (Number(s.memberNo) === Number(memberNo)) {
                    s.memberNo = null;
                    s.customName = '';
                    s.instrument = '';
                }
            });
        });
    }

    // 좌석 상세 팝업 열기
    openSeatDetailModal(rowIndex, seatIndex, seat) {
        this.selectedSeat = { rowIndex, seatIndex, seat };
        const modal = document.getElementById('stageSeatDetailModal');
        if (!modal) return;

        const titleEl = document.getElementById('stageSeatDetailTitle');
        const rowLabel = this.currentPreset.rows[rowIndex]?.label || `${rowIndex + 1}열`;
        if (titleEl) {
            titleEl.textContent = `좌석 설정 (${rowLabel} ${seatIndex + 1}번 좌석)`;
        }

        // 단원 선택 셀렉트 채우기
        const memberSelect = document.getElementById('stageSeatDetailMemberSelect');
        if (memberSelect) {
            memberSelect.innerHTML = '<option value="">-- 단원 선택 (배정 해제 시 비움) --</option>';
            const allMembers = (typeof window.members !== 'undefined' && Array.isArray(window.members)) 
                ? window.members.filter(m => m.isActive !== false)
                : [];

            allMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.no;
                opt.textContent = `[${m.instrument || '기타'}] ${m.name} (No.${m.no})`;
                if (Number(seat.memberNo) === Number(m.no)) {
                    opt.selected = true;
                }
                memberSelect.appendChild(opt);
            });
        }

        // 직접 입력 필드
        const customNameInput = document.getElementById('stageSeatDetailCustomName');
        if (customNameInput) customNameInput.value = seat.customName || '';

        const instInput = document.getElementById('stageSeatDetailInstrument');
        if (instInput) instInput.value = seat.instrument || '';

        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    closeSeatDetailModal() {
        const modal = document.getElementById('stageSeatDetailModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
        this.selectedSeat = null;
    }

    saveSeatDetail() {
        if (!this.selectedSeat || !this.currentPreset) return;
        const { rowIndex, seatIndex } = this.selectedSeat;
        const seat = this.currentPreset.rows[rowIndex].seats[seatIndex];

        const memberSelect = document.getElementById('stageSeatDetailMemberSelect');
        const customNameInput = document.getElementById('stageSeatDetailCustomName');
        const instInput = document.getElementById('stageSeatDetailInstrument');

        const selectedMemberNo = memberSelect?.value ? Number(memberSelect.value) : null;
        const customName = customNameInput?.value.trim() || '';
        let instrument = instInput?.value.trim() || '';

        if (selectedMemberNo) {
            this.clearMemberFromAllSeats(selectedMemberNo);
            seat.memberNo = selectedMemberNo;
            seat.customName = '';
            
            // 단원의 기본 악기 자동 입력
            if (typeof window.members !== 'undefined') {
                const m = window.members.find(mem => Number(mem.no) === selectedMemberNo);
                if (m) instrument = m.instrument || instrument;
            }
        } else {
            seat.memberNo = null;
            seat.customName = customName;
        }

        seat.instrument = instrument;

        this.savePresets();
        this.closeSeatDetailModal();
        this.renderMembersSidebar();
        this.renderStage();
    }

    clearCurrentSeat() {
        if (!this.selectedSeat || !this.currentPreset) return;
        const { rowIndex, seatIndex } = this.selectedSeat;
        const seat = this.currentPreset.rows[rowIndex].seats[seatIndex];
        seat.memberNo = null;
        seat.customName = '';
        seat.instrument = '';

        this.savePresets();
        this.closeSeatDetailModal();
        this.renderMembersSidebar();
        this.renderStage();
    }

    // 열(Row) 관리: 열 추가
    addRow() {
        if (!this.currentPreset) return;
        const nextIdx = this.currentPreset.rows.length + 1;
        const defaultSeatCount = Math.min(16, 6 + (nextIdx - 1) * 3);
        const newRow = {
            id: 'row_' + Date.now(),
            label: `${nextIdx}열`,
            seatCount: defaultSeatCount,
            radius: 170 + (nextIdx - 1) * 95,
            spanAngle: Math.min(160, 105 + (nextIdx - 1) * 15),
            seats: this.generateEmptySeats(defaultSeatCount)
        };

        this.currentPreset.rows.push(newRow);
        this.savePresets();
        this.renderStage();
        this.renderMembersSidebar();
    }

    // 마지막 열 삭제
    removeLastRow() {
        if (!this.currentPreset || this.currentPreset.rows.length <= 1) {
            alert('최소 1개의 열은 유지되어야 합니다.');
            return;
        }

        if (confirm('마지막 열을 삭제하시겠습니까? 배정된 단원이 있다면 좌석에서 해제됩니다.')) {
            this.currentPreset.rows.pop();
            this.savePresets();
            this.renderStage();
            this.renderMembersSidebar();
        }
    }

    // 특정 열의 좌석수 증감 (+1 / -1)
    adjustRowSeats(rowIndex, delta) {
        if (!this.currentPreset || !this.currentPreset.rows[rowIndex]) return;
        const row = this.currentPreset.rows[rowIndex];
        const newCount = row.seats.length + delta;

        if (newCount < 1) {
            alert('좌석 수는 최소 1개 이상이어야 합니다.');
            return;
        }
        if (newCount > 30) {
            alert('한 열당 최대 30석까지 설정 가능합니다.');
            return;
        }

        if (delta > 0) {
            for (let i = 0; i < delta; i++) {
                row.seats.push({
                    id: 'seat_' + Math.random().toString(36).substr(2, 9),
                    seatNum: row.seats.length + 1,
                    memberNo: null,
                    customName: '',
                    instrument: ''
                });
            }
        } else {
            // 끝 좌석 제거
            row.seats.pop();
        }

        row.seatCount = row.seats.length;
        this.savePresets();
        this.renderStage();
        this.renderMembersSidebar();
    }

    // 새 프리셋 생성 팝업
    promptNewPreset() {
        const name = prompt('새 좌석 배치도 이름 입력:', `배치도_${new Date().toLocaleDateString('ko-KR')}`);
        if (!name) return;

        const isArc = confirm('부채꼴(오케스트라/앙상블) 형태로 생성하시겠습니까?\n(취소 클릭 시 직선 격자형으로 생성)');
        const newPreset = this.createDefaultPreset(name, isArc ? 'arc' : 'grid');

        this.presets.push(newPreset);
        this.currentPreset = newPreset;
        this.savePresets();
        this.renderPresetSelector();
        this.renderControls();
        this.renderMembersSidebar();
        this.renderStage();
    }

    // 프리셋 삭제
    deleteCurrentPreset() {
        if (this.presets.length <= 1) {
            alert('최소 1개의 배치도는 유지되어야 합니다.');
            return;
        }

        if (confirm(`'${this.currentPreset.name}' 배치도를 삭제하시겠습니까?`)) {
            this.presets = this.presets.filter(p => p.id !== this.currentPreset.id);
            this.currentPreset = this.presets[0];
            this.savePresets();
            this.renderPresetSelector();
            this.renderControls();
            this.renderMembersSidebar();
            this.renderStage();
        }
    }

    // 전체 좌석 비우기
    clearAllSeats() {
        if (!this.currentPreset) return;
        if (confirm('현재 배치도의 모든 좌석 배정을 초기화하시겠습니까?')) {
            this.currentPreset.rows.forEach(r => {
                r.seats.forEach(s => {
                    s.memberNo = null;
                    s.customName = '';
                    s.instrument = '';
                });
            });
            this.savePresets();
            this.renderMembersSidebar();
            this.renderStage();
        }
    }

    // 파트별 자동 정렬 배치 (바이올린1 -> 바이올린2 -> 비올라 -> 첼로 -> 플루트 순서)
    autoArrangeByInstrument() {
        if (!this.currentPreset) return;
        if (!confirm('현재 등록된 단원들을 파트별로 앞 열부터 순서대로 자동 배치하시겠습니까?\n(기존 배치는 덮어씌워집니다.)')) return;

        const allMembers = (typeof window.members !== 'undefined' && Array.isArray(window.members)) 
            ? [...window.members].filter(m => m.isActive !== false)
            : [];

        // 악기 정렬 우선순위
        const instPriority = ['제1바이올린', '바이올린', '제2바이올린', '비올라', '첼로', '콘트라베이스', '플루트', '오보에', '클라리넷', '바순', '피아노'];
        
        allMembers.sort((a, b) => {
            const getPriority = (inst) => {
                const idx = instPriority.findIndex(p => (inst || '').includes(p));
                return idx === -1 ? 99 : idx;
            };
            const pA = getPriority(a.instrument);
            const pB = getPriority(b.instrument);
            if (pA !== pB) return pA - pB;
            return (a.name || '').localeCompare(b.name || '', 'ko');
        });

        // 모든 좌석 비우기
        this.currentPreset.rows.forEach(r => {
            r.seats.forEach(s => {
                s.memberNo = null;
                s.customName = '';
                s.instrument = '';
            });
        });

        let memberIndex = 0;
        for (const row of this.currentPreset.rows) {
            for (const seat of row.seats) {
                if (memberIndex < allMembers.length) {
                    const m = allMembers[memberIndex];
                    seat.memberNo = Number(m.no);
                    seat.instrument = m.instrument;
                    memberIndex++;
                }
            }
        }

        this.savePresets();
        this.renderMembersSidebar();
        this.renderStage();
    }

    // 인쇄 모드 실행
    printLayout() {
        if (!this.currentPreset) return;
        
        // 인쇄용 타이틀 설정
        const printTitle = document.getElementById('stagePrintTitle');
        if (printTitle) {
            printTitle.textContent = `${this.currentPreset.name} (분당파밀리에앙상블)`;
        }

        window.print();
    }
}

// 전역 인스턴스 초기화 함수
function initStageSeatingManager() {
    if (!window.stageSeatingManager) {
        try {
            window.stageSeatingManager = new StageSeatingManager();
            stageSeatingManager = window.stageSeatingManager;
            console.log('StageSeatingManager 초기화 완료');
        } catch (err) {
            console.error('StageSeatingManager 초기화 실패:', err);
        }
    }
}

// 전역 단축 오픈 함수
window.openSeatingChartModal = function() {
    initStageSeatingManager();
    if (window.stageSeatingManager) {
        window.stageSeatingManager.openModal();
    } else {
        const modal = document.getElementById('seatingChartModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }
};

let stageSeatingManager = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStageSeatingManager);
} else {
    initStageSeatingManager();
}
