import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-6">
        <h1 className="font-manrope font-bold text-2xl text-midnight mb-1">
          Welcome back
        </h1>
        <p className="text-midnight/50 text-sm">
          Sign in to your Aerie workspace
        </p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-surface-2 shadow-none rounded-2xl border-0",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            formButtonPrimary:
              "bg-midnight hover:bg-deep text-surface font-semibold rounded-xl transition-colors",
            formFieldInput:
              "bg-surface border-0 border-b-2 border-transparent focus:border-crimson rounded-lg text-midnight placeholder:text-midnight/40 transition-all",
            formFieldLabel: "text-midnight/70 text-sm font-medium",
            footerActionLink: "text-crimson hover:text-crimson/80 font-medium",
            dividerLine: "bg-active",
            dividerText: "text-midnight/30",
            socialButtonsBlockButton:
              "bg-surface border-0 hover:bg-active text-midnight rounded-xl transition-colors",
            socialButtonsBlockButtonText: "font-medium",
          },
        }}
      />
    </div>
  );
}
