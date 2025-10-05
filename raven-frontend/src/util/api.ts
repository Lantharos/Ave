export async function apiPOST<T>(url: string, body: object): Promise<T> {
    const res = await fetch("http://localhost:7551" + url, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        credentials: "include",       // if you’re using cookies
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiGET<T>(url: string): Promise<T> {
    const res = await fetch("http://localhost:7551" + url, { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
