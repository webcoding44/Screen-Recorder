"use client";

import Link from "next/link";
import Image from "next/image";

import { authClient } from "@/lib/auth-client";


const SignIn = () => {
  return (

    <main className="sign-in">
      <aside className="google-sign-in">
        <section>
          <Link href="/">
            <Image
              src="/assets/icons/play.png"
              alt="SnapChat Logo"
              width={40}
              height={40}
            />
            <h1>SnapCast</h1>
          </Link>
          <p>
            Create and share your very first <span>SnapCast video</span> in no
            time!
          </p>

          <button
            onClick={async () => {
              return await authClient.signIn.social({
                provider: "google",
              });
            }}
          >
            <Image
              src="/assets/icons/google.svg"
              alt="Google Icon"
              width={22}
              height={22}
            />
            <span>Sign in with Google</span>
          </button>
        </section>
      </aside>
      <div className="overlay" />
    </main>
  )
}
export default SignIn;