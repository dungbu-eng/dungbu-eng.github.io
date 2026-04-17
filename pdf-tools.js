document.addEventListener('DOMContentLoaded', () => {
    // 0. Kiểm tra thư viện
    if (typeof PDFLib === 'undefined') {
        alert('Lỗi: Cố gắng tải lại trang. Không thể kết nối tới thư viện xử lý máy chủ (PDFLib).');
        console.error("PDFLib is not defined. Trình duyệt không tải được thư viện mạng.");
        return;
    }

    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

    let currentTool = 'merge'; // Default tool
    let uploadedFiles = []; // Array of File objects
    
    // UI Elements
    const tools = document.querySelectorAll('.menu-group li');
    const toolTitle = document.getElementById('tool-title');
    const toolDesc = document.getElementById('tool-desc');
    
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    
    const btnExecute = document.getElementById('btn-execute');
    const btnReset = document.getElementById('btn-reset');
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('spinner');
    const resultArea = document.getElementById('result-area');
    const downloadLinks = document.getElementById('download-links');
    
    // Config Panels
    const configPanels = document.querySelectorAll('.config-panel');
    const toolConfigDiv = document.getElementById('tool-config');

    // Nút Chọn tệp xử lý sự kiện mặc định
    const btnSelectFile = document.querySelector('.drop-zone-content button');
    if (btnSelectFile) {
        btnSelectFile.addEventListener('click', (e) => {
            e.preventDefault(); // Ngăn submit form nếu có
            fileInput.click();
        });
    }

    // Tool Configurations
    const toolData = {
        'merge': {
            title: 'Gộp nhiều PDF thành một',
            desc: 'Kéo thả các tệp PDF vào khung bên dưới để tự động trộn thành 1 file duy nhất. Bạn có thể kéo thả nhiều file cùng lúc.',
            multiple: true,
            panel: null
        },
        'split': {
            title: 'Tách Trang PDF',
            desc: 'Trích xuất các trang cụ thể thành file PDF mới hoặc chia mỗi trang thành 1 file (mặc định). Chỉ chọn 1 file PDF.',
            multiple: false,
            panel: 'config-split'
        },
        'watermark': {
            title: 'Đóng Dấu Bản Quyền (Watermark)',
            desc: 'Chèn chữ nổi (Watermark) vào giữa tất cả các trang. Chỉ chọn 1 file PDF.',
            multiple: false,
            panel: 'config-watermark'
        },
        'edit': {
            title: 'Chỉnh Sửa (Xoá / Thêm Trang)',
            desc: 'Xoá các trang không cần thiết hoặc thêm trang trắng. Chỉ chọn 1 file PDF.',
            multiple: false,
            panel: null
        }
    };

    // --- 1. TOOL SWITCHING LOGIC ---
    tools.forEach(tool => {
        tool.addEventListener('click', () => {
            try {
                // Update Active State
                tools.forEach(t => t.classList.remove('active'));
                tool.classList.add('active');
                
                currentTool = tool.getAttribute('data-tool');
                const data = toolData[currentTool];
                
                // Update Headers
                toolTitle.innerText = data.title;
                toolDesc.innerText = data.desc;
                
                // Update Input Accept/Multiple
                fileInput.multiple = data.multiple;
                
                // Show/Hide Config Panels
                configPanels.forEach(p => p.style.display = 'none');
                if (data.panel) {
                    toolConfigDiv.style.display = 'block';
                    document.getElementById(data.panel).style.display = 'block';
                } else {
                    toolConfigDiv.style.display = 'none';
                }

                // Nếu đổi từ gộp sang tính năng khác mà có nhiều file, chỉ giữ file đầu
                if (!data.multiple && uploadedFiles.length > 1) {
                    uploadedFiles = [uploadedFiles[0]]; 
                    renderFileList();
                } else if (currentTool === 'edit' && uploadedFiles.length === 1) {
                    // Nếu bấm sang tab Chỉnh Sửa mà đã có sẵn 1 file, mở modal luôn
                    openEditModal(uploadedFiles[0]);
                }
                
                updateExecuteButton();
            } catch(e) {
                console.error(e);
            }
        });
    });

    // --- 2. FILE HANDLING LOGIC ---
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; 
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // Fix: Mở rộng kiểm tra type + extension để hỗ trợ nhiều môi trường lỗi mimetype
        let newFiles = Array.from(files).filter(f => {
            return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        });
        
        if (newFiles.length === 0) {
            alert('Vui lòng chỉ chọn tệp định dạng PDF!');
            return;
        }

        if (!toolData[currentTool].multiple) {
            if (newFiles.length > 1) {
                alert('Công cụ hiện tại chỉ hỗ trợ xử lý 1 file cùng lúc. Đã chọn file đầu tiên.');
            }
            uploadedFiles = [newFiles[0]];
        } else {
            uploadedFiles = [...uploadedFiles, ...newFiles];
        }
        
        resultArea.style.display = 'none'; 
        renderFileList();
    }

    function renderFileList() {
        fileList.innerHTML = '';
        uploadedFiles.forEach((file, index) => {
            const sizeKB = (file.size / 1024).toFixed(1);
            
            const item = document.createElement('div');
            item.className = 'file-item';
            
            let actionsObj = `<button class="btn-icon delete" onclick="removeFile(${index})" title="Xoá file này"><i class="fa-solid fa-trash"></i></button>`;
            
            item.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid fa-file-pdf"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${sizeKB} KB</div>
                    </div>
                </div>
                <div class="file-actions">
                    ${actionsObj}
                </div>
            `;
            fileList.appendChild(item);
        });

        // For Edit mode, open modal automatically if 1 file uploaded
        if (currentTool === 'edit' && uploadedFiles.length === 1) {
            openEditModal(uploadedFiles[0]);
        }

        updateExecuteButton();
    }

    window.removeFile = (index) => {
        uploadedFiles.splice(index, 1);
        renderFileList();
    };

    function updateExecuteButton() {
        if (uploadedFiles.length > 0) {
            btnExecute.disabled = false;
        } else {
            btnExecute.disabled = true;
        }
    }

    // --- 3. PDF PROCESSING LOGIC (CLIENT SIDE) ---
    btnExecute.addEventListener('click', async () => {
        if (uploadedFiles.length === 0) return;
        
        btnExecute.disabled = true;
        statusBox.style.display = 'block';
        spinner.className = 'fa-solid fa-spinner fa-spin';
        statusText.innerText = 'Đang xử lý PDF trên thiết bị...';
        resultArea.style.display = 'none';
        downloadLinks.innerHTML = '';

        try {
            if (currentTool === 'merge') {
                await processMerge();
            } else if (currentTool === 'split') {
                await processSplit();
            } else if (currentTool === 'watermark') {
                await processWatermark();
            } else if (currentTool === 'edit') {
                alert('Vui lòng Click vào file hoặc kéo thả lại để mở Màn hình Chỉnh sửa.');
                resetUI();
                return; // Edit doesn't use the execute button directly for final output
            }

            statusText.innerText = 'Xử lý thành công!';
            spinner.className = 'fa-solid fa-check';
            resultArea.style.display = 'block';

        } catch (error) {
            console.error('Lỗi khi xử lý:', error);
            statusText.innerText = 'Đã xảy ra lỗi!';
            spinner.className = 'fa-solid fa-circle-exclamation';
            alert('Lỗi: ' + error.message);
        } finally {
            btnExecute.disabled = false;
            setTimeout(() => { 
                if(spinner.className.includes('check')) statusBox.style.display = 'none'; 
            }, 3000);
        }
    });

    btnReset.addEventListener('click', resetUI);

    function resetUI() {
        uploadedFiles = [];
        renderFileList();
        resultArea.style.display = 'none';
        downloadLinks.innerHTML = '';
        statusBox.style.display = 'none';
        fileInput.value = '';
    }

    // PDF Tool: Merge
    async function processMerge() {
        const mergedPdf = await PDFDocument.create();
        for (const file of uploadedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        createDownloadLink(pdfBytes, 'Merged_Document.pdf');
    }

    // PDF Tool: Split
    async function processSplit() {
        const file = uploadedFiles[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();
        const splitInput = document.getElementById('split-pages').value.trim();
        
        let targetPages = []; // 0-indexed
        
        if (splitInput === '') {
            targetPages = Array.from({length: totalPages}, (_, i) => i);
            statusText.innerText = 'Đang chia nhỏ từng trang...';
            
            for (let i = 0; i < targetPages.length; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [targetPages[i]]);
                newPdf.addPage(copiedPage);
                const pdfBytes = await newPdf.save();
                createDownloadLink(pdfBytes, `Page_${targetPages[i] + 1}_${file.name}`);
            }
            return;
        } else {
            const parts = splitInput.split(',');
            for (const part of parts) {
                if (part.includes('-')) {
                    const range = part.split('-');
                    let start = parseInt(range[0]) - 1;
                    let end = parseInt(range[1]) - 1;
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let k = start; k <= end; k++) {
                            if (k >= 0 && k < totalPages) targetPages.push(k);
                        }
                    }
                } else {
                    let pageIndex = parseInt(part) - 1;
                    if (!isNaN(pageIndex) && pageIndex >= 0 && pageIndex < totalPages) {
                        targetPages.push(pageIndex);
                    }
                }
            }
            
            targetPages = [...new Set(targetPages)].sort((a,b)=>a-b);
            if(targetPages.length === 0) throw new Error("Phạm vi trang không hợp lệ!");
            
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, targetPages);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await newPdf.save();
            createDownloadLink(pdfBytes, `Extracted_${file.name}`);
        }
    }

    // PDF Tool: Watermark
    // Hàm loại bỏ dấu Tiếng Việt để tương thích tốt với font mặc định
    function removeVietnameseTones(str) {
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
        str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
        str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
        str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ữ/g, "O");
        str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
        str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
        str = str.replace(/Đ/g, "D");
        return str;
    }

    async function processWatermark() {
        const file = uploadedFiles[0];
        let originalText = document.getElementById('watermark-text').value.trim() || 'DungbuApps';
        
        // Font căn bản trong PDF không hỗ trợ Unicode tiếng Việt đầy đủ.
        // Chuyển sang không dấu để tránh bị lỗi hiển thị.
        const safeText = removeVietnameseTones(originalText);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();
        
        for (const page of pages) {
            const { width, height } = page.getSize();
            const fontSize = 60;
            const textWidth = font.widthOfTextAtSize(safeText, fontSize);
            const textHeight = font.heightAtSize(fontSize);

            page.drawText(safeText, {
                x: width / 2 - textWidth / 2,
                y: height / 2 - textHeight / 2,
                size: fontSize,
                font: font,
                color: rgb(0.8, 0.2, 0.2), 
                opacity: 0.3,
                rotate: degrees(45),
            });
        }
        
        const pdfBytes = await pdfDoc.save();
        createDownloadLink(pdfBytes, `Watermarked_${file.name}`);
    }

    function createDownloadLink(uint8Array, filename) {
        const blob = new Blob([uint8Array], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.className = 'download-link-btn';
        a.innerHTML = `<i class="fa-solid fa-download"></i> Tải ${filename}`;
        
        downloadLinks.appendChild(a);
    }

    // --- 4. EDIT MODAL LOGIC ---
    const editModal = document.getElementById('edit-modal');
    const closeBtn = document.querySelector('.close-modal');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const btnAddBlank = document.getElementById('btn-add-blank');
    const pagesGrid = document.getElementById('pages-grid');

    let editPdfDoc = null; 
    let activeFileName = '';

    if (closeBtn) {
        closeBtn.onclick = () => { editModal.style.display = "none"; }
    }
    
    window.onclick = (e) => { 
        if (e.target == editModal) editModal.style.display = "none"; 
    }

    async function openEditModal(file) {
        activeFileName = file.name;
        statusBox.style.display = 'block';
        statusText.innerText = 'Đang đọc cấu trúc trang...';
        
        // Disable save btn to prevent clicking while loading
        btnSaveEdit.disabled = true;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            editPdfDoc = await PDFDocument.load(arrayBuffer);
            renderEditGrid();
            editModal.style.display = 'block';
        } catch (e) {
            alert("Lỗi khi đọc file PDF: " + e.message);
        } finally {
            statusBox.style.display = 'none';
            btnSaveEdit.disabled = false;
        }
    }

    function renderEditGrid() {
        pagesGrid.innerHTML = '';
        if (!editPdfDoc) return;
        const pageCount = editPdfDoc.getPageCount();
        
        for (let i = 0; i < pageCount; i++) {
            const card = document.createElement('div');
            card.className = 'page-card';
            card.innerHTML = `
                <span class="page-num">Trang ${i + 1}</span>
                <div class="page-actions">
                    <button class="btn-icon" title="Xoay 90 độ" onclick="rotatePage(${i})"><i class="fa-solid fa-rotate-right"></i></button>
                    <button class="btn-icon delete" title="Xoá trang" onclick="deletePage(${i})"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            pagesGrid.appendChild(card);
        }
    }

    window.rotatePage = (index) => {
        try {
            const page = editPdfDoc.getPage(index);
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + 90));
            // Visual feedback
            const card = pagesGrid.children[index];
            if (card) {
                card.style.transform = `rotate(2deg) scale(1.05)`;
                setTimeout(() => card.style.transform = 'none', 300);
            }
        } catch(e) {
            console.error(e);
        }
    }

    window.deletePage = (index) => {
        try {
            if(editPdfDoc.getPageCount() <= 1) {
                alert('File PDF phải có ít nhất 1 trang!');
                return;
            }
            editPdfDoc.removePage(index);
            renderEditGrid();
        } catch(e) {
            console.error(e);
        }
    }

    if (btnAddBlank) {
        btnAddBlank.addEventListener('click', () => {
            try {
                const { width, height } = editPdfDoc.getPage(0).getSize();
                editPdfDoc.addPage([width, height]);
                renderEditGrid();
            } catch(e) {
                console.error(e);
            }
        });
    }

    if (btnSaveEdit) {
        btnSaveEdit.addEventListener('click', async () => {
            btnSaveEdit.disabled = true;
            btnSaveEdit.innerText = 'Đang lưu...';
            try {
                const pdfBytes = await editPdfDoc.save();
                editModal.style.display = 'none';
                
                resultArea.style.display = 'block';
                downloadLinks.innerHTML = ''; 
                createDownloadLink(pdfBytes, `Edited_${activeFileName}`);
            } catch(e) {
                alert('Lỗi lưu PDF: ' + e.message);
            } finally {
                btnSaveEdit.disabled = false;
                btnSaveEdit.innerText = 'Lưu thay đổi';
            }
        });
    }

});
