document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-btn');
    const btnText = document.getElementById('btn-text');
    const errorMsg = document.getElementById('error-msg');
    const versionInfo = document.getElementById('version-info');

    // GitHub Repo info
    const REPO_OWNER = 'TDF-Daimonds-Tech';
    const REPO_NAME = 'Gold-app-releases';

    async function fetchLatestRelease() {
        try {
            const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('No releases found in the repository.');
                }
                throw new Error(`GitHub API error: ${response.statusText}`);
            }

            const release = await response.json();
            
            // Look for an APK asset
            const apkAsset = release.assets.find(asset => asset.name.toLowerCase().endsWith('.apk'));

            if (!apkAsset) {
                throw new Error(`Release Version ${release.tag_name} does not contain an APK file.`);
            }

            // Successfully found the APK
            setupDownloadButton(apkAsset.browser_download_url, release.tag_name, apkAsset.size);

        } catch (error) {
            console.error('Error fetching release:', error);
            showError(error.message || 'Failed to fetch the latest APK. Please try again later.');
        }
    }

    function setupDownloadButton(downloadUrl, versionTag, sizeBytes) {
        // Remove loading state
        downloadBtn.classList.remove('loading');
        
        // Format size
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        
        // Update button text and link
        btnText.textContent = `Download Latest APK`;
        downloadBtn.href = downloadUrl;
        
        // Show version info
        versionInfo.textContent = `Version ${versionTag} • ${sizeMB} MB`;
        versionInfo.style.display = 'block';
    }

    function showError(message) {
        downloadBtn.classList.remove('loading');
        btnText.textContent = 'Download Unavailable';
        downloadBtn.style.background = '#2d333b'; // Disabled state
        downloadBtn.style.color = '#8b949e';
        downloadBtn.style.pointerEvents = 'none';

        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
    }

    // Initialize
    fetchLatestRelease();
});
