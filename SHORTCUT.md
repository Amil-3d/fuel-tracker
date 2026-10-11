# "Send to Fuel" Shortcut (Apple Health → Fuel)

This Shortcut copies today's **steps**, **active calories** and your **latest weight** from Apple Health. Then you paste them into Fuel. It takes about 3 minutes to build once.

Why copy and paste? iPhone keeps a home screen web app's data separate from Safari's, and a Shortcut can only open links in Safari. Copying works with the home screen app.

## Build it

1. Open the **Shortcuts** app and tap **+** (top right). Name it **Send to Fuel**.
2. **Steps**
   - Add the action **Find Health Samples**.
   - Set **Type** to **Steps**.
   - Tap **Add Filter**, then set it to **Start Date** · **is today**.
   - Add the action **Calculate Statistics**, and set it to **Sum** of **Health Samples**.
3. **Active calories**
   - Add another **Find Health Samples**.
   - Set **Type** to **Active Energy**, with the filter **Start Date is today**.
   - Add another **Calculate Statistics** set to **Sum**, using the *second* Health Samples.
4. **Weight**
   - Add another **Find Health Samples** and set **Type** to **Weight**.
   - Set **Sort by** to **Start Date**, **Order** to **Latest First**, and turn on **Limit** with **1** sample.
5. Add a **Text** action and type `fuel: steps=`. Then insert the variables so it reads:
   `fuel: steps=[Statistics]; active=[Statistics 2]; weight=[Health Samples 3]`
   (Tap in the text field and pick each one from the variable bar above the keyboard.)
6. Add **Copy to Clipboard** (it uses the Text).
7. Optional: add **Show Notification** saying "Copied for Fuel".
8. Tap **Done**. The first time you run it, allow access to Health when asked.

## Use it

1. Run **Send to Fuel**. You can do this from the Shortcuts app, a home screen icon (Share → Add to Home Screen) or Siri ("Send to Fuel").
2. Open **Fuel** and tap the **Activity** card on Today, then tap **Paste from Shortcut**. Allow the paste.
3. Check the numbers and tap **Save**. Leave "Also log this weight" on if you want the weight saved too. Your targets update from it.

Active calories are shown for reference only. Your calorie target already counts your usual activity, so Fuel doesn't add them on top.

## Troubleshooting

- **"The clipboard doesn't have Fuel data in it"**: run the Shortcut again right before tapping Paste.
- **Steps show 0**: check that Shortcuts has permission in **Settings → Health → Data Access & Devices → Shortcuts**.
- **Using Fuel in Safari instead of the home screen app?** You can replace steps 6–7 with **Open URLs**, using
  `https://amil-3d.github.io/fuel-tracker/#/import?steps=[Statistics]&active=[Statistics 2]&weight=[Health Samples 3]`
