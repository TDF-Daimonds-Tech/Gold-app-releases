document.addEventListener('DOMContentLoaded', () => {
    // Each app on this page installs from the newest GitHub Release that matches
    // its tagPrefix ('' = newest release of the repo, whatever it is tagged).
    const APPS = [
        {
            name: 'Gold App',
            repo: 'TDF-Daimonds-Tech/Gold-app-releases',
            tagPrefix: '',
            ids: {
                button: 'download-btn',
                buttonText: 'btn-text',
                versionInfo: 'version-info',
                errorMsg: 'error-msg',
                size: 'app-size-display',
                releaseName: 'release-name-display',
            },
        },
        {
            // Built by .github/workflows/android-twa.yml from android/tms
            name: 'TDF Task Manager',
            repo: 'TDF-Daimonds-Tech/Gold-app-web',
            tagPrefix: 'tms-v',
            ids: {
                button: 'tms-download-btn',
                buttonText: 'tms-btn-text',
                versionInfo: 'tms-version-info',
                errorMsg: 'tms-error-msg',
                size: 'tms-app-size',
                releaseName: 'tms-release-name',
            },
        },
    ];

    function resolveElements(ids) {
        const els = {};
        Object.entries(ids).forEach(([key, id]) => {
            els[key] = document.getElementById(id);
        });
        return els;
    }

    async function fetchLatestRelease(app) {
        const els = resolveElements(app.ids);
        if (!els.button) return; // app not present on this page

        try {
            // Fetch all releases (this includes pre-releases, unlike /releases/latest)
            const url = `https://api.github.com/repos/${app.repo}/releases`;
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

            // Newest release for this app (the API returns them newest first)
            const release = releases.find(r => r.tag_name.startsWith(app.tagPrefix));

            if (!release) {
                throw new Error('No releases found in the repository.');
            }

            // Look for an APK asset
            const apkAsset = release.assets.find(asset => asset.name.toLowerCase().endsWith('.apk'));

            if (!apkAsset) {
                throw new Error(`Release Version ${release.tag_name} does not contain an APK file.`);
            }

            // Successfully found the APK
            const version = release.tag_name.slice(app.tagPrefix.length);
            setupDownloadButton(els, apkAsset.browser_download_url, version, apkAsset.size, release.name);

        } catch (error) {
            console.error(`Error fetching release for ${app.name}:`, error);
            showError(els, error.message || 'Failed to fetch the latest APK. Please try again later.');
        }
    }

    function setupDownloadButton(els, downloadUrl, versionTag, sizeBytes, releaseName) {
        // Remove loading state
        els.button.classList.remove('loading');

        // Format size
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);

        // Update button text and link
        els.buttonText.textContent = `Install`;
        els.button.href = downloadUrl;

        // Show version info
        els.versionInfo.textContent = `Version ${versionTag}`;
        if (els.size) {
            els.size.textContent = `${sizeMB} MB`;
        }
        if (els.releaseName && releaseName) {
            els.releaseName.textContent = releaseName;
        }
    }

    function showError(els, message) {
        els.button.classList.remove('loading');
        els.buttonText.textContent = 'Unavailable';
        els.button.style.background = 'var(--divider, #e5e5ea)'; // Disabled state
        els.button.style.color = 'var(--text-secondary, #8e8e93)';
        els.button.style.pointerEvents = 'none';

        els.errorMsg.textContent = message;
        els.errorMsg.style.display = 'block';
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
    APPS.forEach(app => fetchLatestRelease(app));
});
