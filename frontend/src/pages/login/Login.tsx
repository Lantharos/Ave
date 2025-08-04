export default function Login() {
    return (
        <>
            <div className={"navbar"}>
                <div className={"nav"}>
                    <button className={"nav-button"}>about</button>
                    <button className={"nav-button-selected"}>login</button>
                    <button className={"nav-button"}>devs</button>
                    <button className={"nav-button"}>faq</button>
                </div>

                <div className={"nav-links"}>
                    <a href="/terms-of-service" className={"nav-link"}>terms of service</a>
                    <a href="/privacy-policy" className={"nav-link"}>privacy policy</a>
                </div>
            </div>

            <div className={"main"}>
                <h1 className={"heading"}>Login to RAVEN.</h1>
                <p className={"subheading"}>
                    Enter your credentials to access your account.
                </p>
            </div>
        </>
    )
}