import { useState, type ChangeEvent } from "react";

type Props = {
    onEnabled?: () => void;
    onDisabled?: () => void;
    defaultOn?: boolean;
};

export default function GooeyCheckbox({ onEnabled, onDisabled, defaultOn = false }: Props) {
    const [isOn, setIsOn] = useState(defaultOn);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        const v = e.target.checked;
        setIsOn(v);
        if (v) onEnabled?.(); else onDisabled?.();
    };

    return (
        <div
            data-on={isOn}
            className="group relative aspect-[292/142] h-[60px]"
        >
            {/* a11y checkbox overlays everything */}
            <input
                type="checkbox"
                checked={isOn}
                onChange={onChange}
                className="absolute inset-0 z-10 m-0 h-full w-full appearance-none cursor-pointer"
                aria-checked={isOn}
                aria-label="Toggle"
            />

            <svg
                className="h-full w-full overflow-visible"
                viewBox="0 0 292 142"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Track */}
                <path
                    d="M71 142C31.7878 142 0 110.212 0 71C0 31.7878 31.7878 0 71 0C110.212 0 119 30 146 30C173 30 182 0 221 0C260 0 292 31.7878 292 71C292 110.212 260.212 142 221 142C181.788 142 173 112 146 112C119 112 110.212 142 71 142Z"
                    className="
            transition-[fill] duration-[400ms]
            fill-[#d3d3d6]
            group-data-[on=true]:fill-[#8A7B8A]
          "
                />

                {/* Icons */}
                <rect
                    x="64" y="39" width="12" height="64" rx="6"
                    className="
            transition-[fill] duration-[400ms]
            fill-[#d3d3d6]
            group-data-[on=true]:fill-white
          "
                />
                <path
                    fillRule="evenodd"
                    d="M221 91C232.046 91 241 82.0457 241 71C241 59.9543 232.046 51 221 51C209.954 51 201 59.9543 201 71C201 82.0457 209.954 91 221 91ZM221 103C238.673 103 253 88.6731 253 71C253 53.3269 238.673 39 221 39C203.327 39 189 53.3269 189 71C189 88.6731 203.327 103 221 103Z"
                    className="
            transition-[fill] duration-[400ms]
            fill-[#eaeaec]
            group-data-[on=true]:fill-[#8A7B8A]
          "
                />

                {/* Goo group */}
                <g filter="url(#goo)">
                    {/* center pill (ONLY CHANGE IS HERE) */}
                    <rect
                        x="13" y="42" width="116" height="58" rx="29" fill="#fff"
                        className="
              opacity-100
              transition-transform duration-[600ms]
              group-data-[on=true]:translate-x-[150px]
              group-data-[on=true]:opacity-0
              group-data-[on=true]:[transition:transform_600ms,opacity_0ms_320ms]
            "
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    />

                    {/* left blob */}
                    <rect
                        x="14" y="14" width="114" height="114" rx="58" fill="#fff"
                        className="
              transition-transform duration-[450ms] [backface-visibility:hidden]
              scale-100
              group-data-[on=true]:scale-0
            "
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    />

                    {/* right blob */}
                    <rect
                        x="164" y="14" width="114" height="114" rx="58" fill="#fff"
                        className="
                          transition-transform duration-[450ms] [backface-visibility:hidden]
                          [transform:scale(0.001)]
                          group-data-[on=true]:scale-100
                        "
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    />
                </g>

                <filter id="goo">
                    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                        result="goo"
                    />
                </filter>
            </svg>
        </div>
    );
}
