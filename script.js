document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-btn');
    const btnText = document.getElementById('btn-text');
    const errorMsg = document.getElementById('error-msg');
    const versionInfo = document.getElementById('version-info');
    const appSizeDisplay = document.getElementById('app-size-display');
    const releaseNameDisplay = document.getElementById('release-name-display');

    // GitHub Repo info
    const REPO_OWNER = 'TDF-Daimonds-Tech';
    const REPO_NAME = 'Gold-app-releases';

    async function fetchLatestRelease() {
        try {
            // Fetch all releases (this includes pre-releases, unlike /releases/latest)
            const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('No releases found in the repository.');
                }
                throw new Error(`GitHub API error: ${response.statusText}`);
            }

            const releases = await response.json();
            
            if (!releases || releases.length === 0) {
                throw new Error('No releases found in the repository.');
            }

            // Get the newest release (index 0)
            const release = releases[0];
            
            // Look for an APK asset
            const apkAsset = release.assets.find(asset => asset.name.toLowerCase().endsWith('.apk'));

            if (!apkAsset) {
                throw new Error(`Release Version ${release.tag_name} does not contain an APK file.`);
            }

            // Successfully found the APK
            setupDownloadButton(apkAsset.browser_download_url, release.tag_name, apkAsset.size, release.name);

        } catch (error) {
            console.error('Error fetching release:', error);
            showError(error.message || 'Failed to fetch the latest APK. Please try again later.');
        }
    }

    function setupDownloadButton(downloadUrl, versionTag, sizeBytes, releaseName) {
        // Remove loading state
        downloadBtn.classList.remove('loading');
        
        // Format size
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
        
        // Update button text and link
        btnText.textContent = `Install`;
        downloadBtn.href = downloadUrl;
        
        // Show version info
        versionInfo.textContent = `Version ${versionTag}`;
        if (appSizeDisplay) {
            appSizeDisplay.textContent = `${sizeMB} MB`;
        }
        if (releaseNameDisplay && releaseName) {
            releaseNameDisplay.textContent = releaseName;
        }
    }

    function showError(message) {
        downloadBtn.classList.remove('loading');
        btnText.textContent = 'Unavailable';
        downloadBtn.style.background = 'var(--divider, #e5e5ea)'; // Disabled state
        downloadBtn.style.color = 'var(--text-secondary, #8e8e93)';
        downloadBtn.style.pointerEvents = 'none';

        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
    }

    // Modal Image Gallery Logic
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const captionText = document.getElementById('modal-caption');
    const closeBtn = document.getElementById('close-modal');
    const prevBtn = document.getElementById('prev-img');
    const nextBtn = document.getElementById('next-img');
    
    // Get all screenshot images
    const screenshots = document.querySelectorAll('.screenshot');
    let currentImageIndex = 0;

    // Attach click event to all screenshots
    screenshots.forEach((img, index) => {
        img.style.cursor = 'pointer'; // Make them look clickable
        img.addEventListener('click', () => {
            currentImageIndex = index;
            showImageInModal(currentImageIndex);
            
            // Show modal with animation
            modal.style.display = "block";
            // small delay to allow display block to apply before opacity transition
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        });
    });

    function showImageInModal(index) {
        // Handle out of bounds
        if (index >= screenshots.length) {
            currentImageIndex = 0;
        }
        if (index < 0) {
            currentImageIndex = screenshots.length - 1;
        }
        
        const targetImg = screenshots[currentImageIndex];
        modalImg.src = targetImg.src;
        captionText.innerHTML = targetImg.alt;
    }

    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = "none";
        }, 300); // match transition duration in CSS
    }

    // Navigation and Close buttons
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    
    if(prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent modal close
            showImageInModal(currentImageIndex - 1);
        });
    }

    if(nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent modal close
            showImageInModal(currentImageIndex + 1);
        });
    }

    // Close when clicking empty space
    if(modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (modal && modal.style.display === "block") {
            if (e.key === "Escape") closeModal();
            if (e.key === "ArrowLeft") showImageInModal(currentImageIndex - 1);
            if (e.key === "ArrowRight") showImageInModal(currentImageIndex + 1);
        }
    });

    // Initialize
    fetchLatestRelease();
});
