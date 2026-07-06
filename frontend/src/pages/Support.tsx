export function Support() {
  return (
    <div className="flex-1 p-margin flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="max-w-xl text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-surface border-4 border-on-background neo-shadow-sm flex items-center justify-center rounded-full mb-6 text-primary">
          <span className="material-symbols-outlined text-[48px]">contact_support</span>
        </div>
        
        <h1 className="font-display-lg text-[40px] text-on-background uppercase tracking-tight leading-none mb-4">
          Need Help?
        </h1>
        
        <p className="font-body-lg text-body-lg text-secondary mb-8">
          If you are experiencing issues with production logging, material tracking, or any other feature of the GMPL Copilot, our support team is available to assist you.
        </p>

        <div className="w-full bg-surface border-2 border-on-background p-6 neo-shadow text-left">
          <h3 className="font-headline-md mb-4 border-b-2 border-dashed border-on-background pb-2">Contact Methods</h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[24px]">email</span>
              <div>
                <div className="font-label-sm uppercase text-secondary">Email Support</div>
                <div className="font-data-md font-bold">support@ganesmetplast.com</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[24px]">phone</span>
              <div>
                <div className="font-label-sm uppercase text-secondary">IT Operations Line</div>
                <div className="font-data-md font-bold">+91 98765 43210</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
