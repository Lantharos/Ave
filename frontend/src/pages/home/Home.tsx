import LightRays from "../../components/Backgrounds/LightRays.tsx";

function Home() {
    return (
        <>
            <div style={{ width: '100vw', height: '100vh', position: 'fixed', marginTop: '-20px' }}>
                <LightRays
                    raysOrigin="bottom-center"
                    raysColor="#8A7B8A"
                    raysSpeed={1.3}
                    lightSpread={2}
                    rayLength={3}
                    fadeDistance={2}
                    saturation={0}
                    followMouse={false}
                    noiseAmount={0.1}
                    distortion={0.05}
                    className="custom-rays"
                />
            </div>
            <div className="mt-5 flex justify-between items-start w-full relative">
                <div className="absolute left-1/2 -translate-x-1/2 flex gap-[60px] mt-[20px]">
                    <button className="text-[#8A7B8A] text-center bg-transparent border-none font-poppins text-[28px] font-normal">about</button>
                    <button className="text-[#9C9C9C] cursor-pointer bg-transparent border-none hover:text-[#D8D7D7] transition-colors duration-300 font-poppins text-[28px] font-normal" onClick={() => window.location.href='/login'}>login</button>
                    <button className="text-[#9C9C9C] cursor-pointer bg-transparent border-none hover:text-[#D8D7D7] transition-colors duration-300 font-poppins text-[28px] font-normal" onClick={() => window.location.href='https://asterisk.lanth.me'}>devs</button>
                    <button className="text-[#9C9C9C] cursor-pointer bg-transparent border-none hover:text-[#D8D7D7] transition-colors duration-300 font-poppins text-[28px] font-normal" onClick={() => window.location.href='/faq'}>faq</button>
                </div>
                <div className="ml-auto flex flex-col gap-1 items-end pr-5 mr-[10px] mt-[10px]">
                    <a href="/terms-of-service" className="text-accent font-poppins text-[20px] font-normal no-underline hover:text-[#B4A6B5] transition-colors duration-300">terms of service</a>
                    <a href="/privacy-policy" className="text-accent font-poppins text-[20px] font-normal no-underline hover:text-[#B4A6B5] transition-colors duration-300 mt-[10px]">privacy policy</a>
                </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] inline-flex flex-col justify-center items-center gap-[100px] z-10">
                <div className="flex flex-col justify-center items-center gap-2 text-center">
                    <h1 className="text-[#D8D7D7] font-poppins text-[110px] font-[600] leading-none m-0 p-0">Meet RAVEN.</h1>
                    <p className="text-[#A8A8A8] w-[1284px] h-[108px] text-justify font-poppins text-[36px] font-normal leading-snug">Say goodbye to juggling multiple accounts and passwords with RAVEN, managing your digital life has never been this simple — or this secure.</p>
                </div>
                <button className="flex w-[583px] h-32 px-10 justify-center items-center gap-10 rounded-[32px] bg-accent hover:bg-[#a190a1] active:bg-[#635963] cursor-pointer transition-colors duration-300 outline-none border-0" onClick={() => window.location.href='/register'}>
                    <svg width="53" height="48" viewBox="0 0 53 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16.4103 36.0793L13.2722 33.1827C12.409 32.3859 12.1043 31.2328 12.4902 30.1642C12.7949 29.3298 13.2011 28.2424 13.6886 26.9957H2.94382C2.07043 26.9957 1.25797 26.5644 0.821273 25.8614C0.384577 25.1583 0.394733 24.2959 0.841585 23.6022L6.17334 15.3059C7.49358 13.2529 9.88018 11.9968 12.4597 11.9968H20.8179C21.0616 11.6218 21.3054 11.275 21.5491 10.9375C29.8666 -0.386636 42.2566 -0.761607 49.65 0.494547C50.828 0.691407 51.7421 1.54447 51.9655 2.63188C53.3264 9.46574 52.91 20.893 40.652 28.5705C40.2966 28.7955 39.9106 29.0205 39.5044 29.2455V36.9605C39.5044 39.3416 38.1436 41.5539 35.9194 42.7632L26.9316 47.6847C26.1801 48.0972 25.2458 48.1065 24.4841 47.7034C23.7224 47.3004 23.2553 46.5598 23.2553 45.7442V35.695C21.8233 36.1543 20.5742 36.5293 19.6297 36.8105C18.4922 37.148 17.2532 36.8574 16.4002 36.0793H16.4103ZM39.5044 15.7465C40.5818 15.7465 41.6151 15.3514 42.3769 14.6482C43.1387 13.945 43.5667 12.9913 43.5667 11.9968C43.5667 11.0023 43.1387 10.0486 42.3769 9.34535C41.6151 8.64214 40.5818 8.24708 39.5044 8.24708C38.427 8.24708 37.3938 8.64214 36.6319 9.34535C35.8701 10.0486 35.4421 11.0023 35.4421 11.9968C35.4421 12.9913 35.8701 13.945 36.6319 14.6482C37.3938 15.3514 38.427 15.7465 39.5044 15.7465Z" fill="#D8D7D7"/>
                    </svg>
                    <p className="text-[#D8D7D7] ml-[40px] font-poppins text-[48px] font-[600] leading-[22px]">Get Started</p>
                </button>
            </div>
            {/*<div className={"blur-[200px]"}>*/}
            {/*    <div className={"blur-[200px]"}>*/}
            {/*        <div className={"blur-[200px]"}>*/}
            {/*            <div className="absolute w-full h-[698px] grid grid-cols-3 gap-x-20 place-content-end -z-10 blur-[300px] scale-y-[-1]">*/}
            {/*                <div className="blur-[200px] w-[312px] h-[247px] rounded-full bg-accent" />*/}
            {/*                <div className="blur-[200px] w-[444px] h-[448px] rounded-full bg-accent" />*/}
            {/*                <div className="blur-[200px] w-[335px] h-[228px] rounded-full bg-accent" />*/}
            {/*                <div className="blur-[200px] w-[557px] h-[355px] rounded-full bg-accent" />*/}
            {/*                <div className="blur-[200px] w-[219px] h-[171px] rounded-full bg-accent" />*/}
            {/*                <div className="blur-[200px] w-[520px] h-[158px] rounded-full bg-accent" />*/}
            {/*            </div>*/}
            {/*        </div>*/}
            {/*    </div>*/}
            {/*</div>*/}
        </>
    )
}

export default Home