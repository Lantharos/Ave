<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext, trustCodes = [] } = $props<{ 
        onNext?: () => void;
        trustCodes?: string[];
    }>();
    
    let copied = $state<[boolean, boolean]>([false, false]);
    let confirmed = $state(false);
    let downloadingPdf = $state(false);

    function copyCode(index: 0 | 1, code: string) {
        navigator.clipboard.writeText(code);
        copied[index] = true;
        setTimeout(() => {
            copied[index] = false;
        }, 2000);
    }

    async function downloadAsPdf() {
        if (trustCodes.length < 2) return;
        
        downloadingPdf = true;
        
        try {
            // Create a simple PDF using browser's print functionality
            const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Ave Trust Codes</title>
    <style>
        @page { margin: 1.5cm; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
        }
        h1 { 
            color: #333; 
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            color: #856404;
        }
        .code-box {
            background: #f5f5f5;
            border: 2px solid #ddd;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .code-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .code-value {
            font-family: monospace;
            font-size: 18px;
            color: #000;
            margin-top: 8px;
            word-break: break-all;
        }
        .footer {
            margin-top: 40px;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Ave Trust Codes</h1>
    <div class="warning">
        <strong>Keep these codes safe!</strong><br>
        These are your backup codes for account recovery. Store them securely like important documents.
        Anyone with these codes can access your account.
    </div>
    <div class="code-box">
        <div class="code-label">Primary Trust Code</div>
        <div class="code-value">${trustCodes[0]}</div>
    </div>
    <div class="code-box">
        <div class="code-label">Backup Trust Code</div>
        <div class="code-value">${trustCodes[1]}</div>
    </div>
    <div class="footer">
        Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
        Ave ID - aveid.net
    </div>
</body>
</html>`;

            // Create a blob and download
            const blob = new Blob([printContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            // Open in new window for printing/saving as PDF
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                };
            }
            
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to generate PDF:', e);
        } finally {
            downloadingPdf = false;
        }
    }

    function saveToPasswordManager() {
        // Create a fake form to trigger password manager save
        // This creates a credential that password managers can pick up
        if (trustCodes.length < 2) return;
        
        const combinedCodes = `Primary: ${trustCodes[0]}\nBackup: ${trustCodes[1]}`;
        
        // Try to use the Credential Management API if available
        if ('PasswordCredential' in window) {
            try {
                // @ts-ignore - PasswordCredential exists in browsers
                const credential = new PasswordCredential({
                    id: 'ave-trust-codes',
                    password: combinedCodes,
                    name: 'Ave Trust Codes',
                });
                // @ts-ignore
                navigator.credentials.store(credential);
            } catch (e) {
                // Fallback: copy to clipboard with instructions
                navigator.clipboard.writeText(combinedCodes);
                alert('Trust codes copied to clipboard. You can now paste them into your password manager.');
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(combinedCodes);
            alert('Trust codes copied to clipboard. You can now paste them into your password manager.');
        }
    }

    let canContinue = $derived(confirmed);
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px]">
    <div class="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-[100px] w-full z-10">
        <div class="flex flex-col gap-4 md:gap-[10px] w-full md:w-[50%]">
            <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">YOUR TRUST CODES</h2>

            <p class="font-normal text-[#878787] text-base md:text-[24px]">
                These codes are your last resort for restoring access if you ever lose all your trusted devices.
                <br><br>
                Keep them somewhere safe — like where you'd store important documents such as your ID or birth certificate, as anyone with these codes can log in to your Ave.
                <br><br>
                <span class="text-yellow-500">Write them down or save them securely. You won't be able to see them again.</span>
            </p>
        </div>

        <div class="flex flex-col gap-2 md:gap-[10px] w-full md:w-[40%]">
            <div class="flex flex-col gap-2 md:gap-[10px] p-5 md:p-[30px] bg-[#171717] rounded-[24px] md:rounded-[32px]">
                <span class="font-black text-[#878787] text-sm md:text-[16px]">PRIMARY TRUST CODE</span>
                <span class="font-medium text-white text-lg md:text-[24px] break-all">{trustCodes[0] ?? "Loading..."}</span>
                <button 
                    class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-4 md:px-[15px] py-2 md:py-[10px] rounded-full text-sm md:text-[16px] font-medium transition-colors duration-300"
                    onclick={() => copyCode(0, trustCodes[0])}
                    disabled={!trustCodes[0]}
                >
                    <span class="font-black text-[#D3D3D3]">
                        {copied[0] ? "COPIED!" : "COPY TO CLIPBOARD"}
                    </span>
                </button>
            </div>

            <div class="flex flex-col gap-2 md:gap-[10px] p-5 md:p-[30px] bg-[#171717] rounded-[24px] md:rounded-[32px]">
                <span class="font-black text-[#878787] text-sm md:text-[16px]">BACKUP TRUST CODE</span>
                <span class="font-medium text-white text-lg md:text-[24px] break-all">{trustCodes[1] ?? "Loading..."}</span>
                <button 
                    class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-4 md:px-[15px] py-2 md:py-[10px] rounded-full text-sm md:text-[16px] font-medium transition-colors duration-300"
                    onclick={() => copyCode(1, trustCodes[1])}
                    disabled={!trustCodes[1]}
                >
                    <span class="font-black text-[#D3D3D3]">
                        {copied[1] ? "COPIED!" : "COPY TO CLIPBOARD"}
                    </span>
                </button>
            </div>
            
            <!-- Save options -->
            <div class="flex flex-row gap-2 md:gap-[10px]">
                <button 
                    class="flex-1 cursor-pointer bg-[#222222] hover:bg-[#333333] text-white px-4 md:px-[15px] py-3 md:py-[12px] rounded-full text-sm md:text-[14px] font-medium transition-colors duration-300 flex items-center justify-center gap-2"
                    onclick={downloadAsPdf}
                    disabled={downloadingPdf || trustCodes.length < 2}
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <polyline points="9,15 12,18 15,15"/>
                    </svg>
                    {downloadingPdf ? "OPENING..." : "SAVE AS PDF"}
                </button>
                <button 
                    class="flex-1 cursor-pointer bg-[#222222] hover:bg-[#333333] text-white px-4 md:px-[15px] py-3 md:py-[12px] rounded-full text-sm md:text-[14px] font-medium transition-colors duration-300 flex items-center justify-center gap-2"
                    onclick={saveToPasswordManager}
                    disabled={trustCodes.length < 2}
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    SAVE TO PASSWORDS
                </button>
            </div>

            <label class="flex items-center gap-3 p-4 bg-[#171717] rounded-2xl cursor-pointer">
                <input 
                    type="checkbox" 
                    class="w-5 h-5 accent-white"
                    bind:checked={confirmed}
                />
                <span class="text-white text-sm">I have saved my trust codes somewhere safe</span>
            </label>

            <Button 
                text="CONTINUE" 
                onclick={() => onNext?.()} 
                icon="/icons/chevronbk-right-38.svg"
                disabled={!canContinue}
            />
        </div>
    </div>
</div>
