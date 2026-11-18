import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { companyAddress, companyName, contactEmail } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "What personal data the Careerden website and the Careerden Unplugged desktop app process, why, and your rights under the GDPR and KVKK.",
  path: "/privacy",
});

const contactLink = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    content: (
      <>
        <p>
          This policy covers the careerden.app website and the Careerden Unplugged desktop app. The
          controller for the website is {companyName}
          {companyAddress ? `, ${companyAddress}` : ""}. You can reach us about privacy at{" "}
          {contactLink}.
        </p>
        <p>
          In short: the desktop app keeps your data on your computer and never sends it to us. The
          website collects only what it needs to load pages and count visits, without cookies.
        </p>
      </>
    ),
  },
  {
    id: "app",
    title: "The desktop app keeps your data on your device",
    content: (
      <>
        <p>
          Your profile, CVs, job postings, match analyses, generated documents, reminders, and
          settings are stored in the app&apos;s data folder on your computer. Careerden Unplugged
          has no account, and it sends no telemetry, analytics, or crash reports. We cannot see,
          access, or recover this data.
        </p>
        <p>
          AI provider keys are encrypted with your operating system&apos;s keychain. Backups you
          export and log files stay on your computer unless you choose to send them to someone, for
          example by attaching diagnostics to an email.
        </p>
      </>
    ),
  },
  {
    id: "connections",
    title: "Connections the app makes from your device",
    content: (
      <>
        <p>
          The app connects directly to the following services. These requests go from your computer
          to the service, not through us, and each service processes them under its own privacy
          terms:
        </p>
        <ul>
          <li>
            <strong>GitHub</strong>, to check for and download updates and to fetch the list of
            available AI models. GitHub sees your IP address and app version.
          </li>
          <li>
            <strong>LinkedIn</strong>, when you import a job posting by its link. The app fetches
            the public posting without signing in to any LinkedIn account.
          </li>
          <li>
            <strong>The AI provider you choose</strong> (OpenAI, Anthropic, Google Gemini, DeepSeek,
            or OpenRouter), when you run an analysis or generate a document. The app sends the
            relevant profile and job details with your own API key, under your agreement with that
            provider. Check the provider&apos;s terms for how long it keeps requests and whether it
            uses them for training.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "website",
    title: "What the website processes",
    content: (
      <>
        <ul>
          <li>
            <strong>Request data.</strong> To deliver pages and protect the server, our web server
            receives your IP address, browser user agent, the page requested, and the time.
          </li>
          <li>
            <strong>Visit statistics.</strong> We run our own copy of Umami, a privacy-focused
            analytics tool. It sets no cookies and does not store your IP address: the address is
            used only for a moment to work out your country and region and to create an anonymous
            visit identifier that cannot be traced back to you. Umami records the pages you view,
            the referring site, your browser, operating system, device type, screen size, language,
            and country, and which installer you download (file, platform, and architecture).
          </li>
          <li>
            <strong>Email.</strong> If you write to us, we receive your name, email address, and
            whatever you include in the message.
          </li>
        </ul>
        <p>
          We do not use advertising, tracking pixels, or third-party analytics, and we do not sell
          or share personal data for marketing.
        </p>
      </>
    ),
  },
  {
    id: "basis",
    title: "Why we use it and on what basis",
    content: (
      <ul>
        <li>
          Delivering the website, keeping it secure, and fixing errors: our legitimate interest in
          running a working and safe website (GDPR Article 6(1)(f)).
        </li>
        <li>
          Counting visits and downloads to understand how the website is used: our legitimate
          interest in improving it, using cookieless analytics that does not identify you (GDPR
          Article 6(1)(f)).
        </li>
        <li>
          Answering your messages: our legitimate interest in responding to you, or steps you ask
          for before using a service (GDPR Article 6(1)(b) and (f)).
        </li>
      </ul>
    ),
  },
  {
    id: "recipients",
    title: "Service providers",
    content: (
      <>
        <p>We use these providers to run the website and handle email:</p>
        <ul>
          <li>
            <strong>OVH</strong>, which hosts the website and our analytics server in Germany.
          </li>
          <li>
            <strong>Google Workspace</strong>, which hosts our email.
          </li>
          <li>
            <strong>GitHub</strong>, which hosts the installer files the download page links to.
            Downloading an installer connects your browser to GitHub.
          </li>
        </ul>
        <p>
          We may also disclose data when the law requires it or to protect people or the service.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    content: (
      <p>
        The website and analytics run on servers in Germany, in the European Union. Google may
        process email in other countries, and GitHub is based in the United States. Where data
        leaves the country you are in, we rely on the safeguards the law provides, such as adequacy
        decisions and standard contractual clauses offered by these providers.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <ul>
        <li>Server request logs: no longer than 30 days.</li>
        <li>Visit statistics: no longer than 24 months.</li>
        <li>
          Emails: as long as needed to deal with your message, and no longer than two years after
          the conversation ends, unless we need them for a legal claim.
        </li>
        <li>Data in the desktop app: on your computer until you delete it.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    content: (
      <>
        <p>
          You may ask for access to, correction of, or deletion of your personal data; ask us to
          restrict or stop processing it; ask for a copy to take elsewhere; and object to processing
          based on legitimate interests. Write to {contactLink}. We answer within one month and may
          ask for information to confirm the request is yours. See{" "}
          <a href="/gdpr">your data rights</a> for details.
        </p>
        <p>
          Because the desktop app keeps your data on your computer, you can view, export, and delete
          it yourself at any time; see <a href="/data-deletion">deleting your data</a>. You can also
          complain to the data protection authority where you live.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    content: <p>Careerden is not intended for children under 16.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        When this policy changes, we update the date at the top of this page. If a change is
        significant, we also say so in the release notes of the next app version.
      </p>
    ),
  },
  {
    id: "kvkk",
    title: "Türkiye: KVKK aydınlatma metni",
    content: (
      <div lang="tr">
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) madde 10 uyarınca, Türkiye&apos;deki
          kullanıcılar için aşağıdaki bilgileri sunuyoruz.
        </p>
        <ul>
          <li>
            <strong>Veri sorumlusu:</strong> {companyName}
            {companyAddress ? `, ${companyAddress}` : ""}. İletişim: {contactLink}.
          </li>
          <li>
            <strong>İşlenen veriler:</strong> careerden.app web sitesini ziyaret ettiğinizde IP
            adresiniz, tarayıcı bilgileriniz, ziyaret ettiğiniz sayfalar ve indirdiğiniz kurulum
            dosyası; bize e-posta gönderirseniz adınız, e-posta adresiniz ve mesajınızın içeriği.
            Careerden Unplugged masaüstü uygulamasındaki profil, CV ve başvuru verileriniz yalnızca
            sizin bilgisayarınızda tutulur; bunlara erişimimiz yoktur ve bu verileri işlemeyiz.
          </li>
          <li>
            <strong>İşleme amaçları:</strong> web sitesini sunmak ve güvenliğini sağlamak, çerez
            kullanmadan ziyaret ve indirme istatistiği tutmak, mesajlarınızı yanıtlamak.
          </li>
          <li>
            <strong>Toplama yöntemi ve hukuki sebep:</strong> veriler web sitesi ve e-posta
            aracılığıyla otomatik ve kısmen otomatik yollarla toplanır. Hukuki sebep, temel hak ve
            özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaatidir (KVKK madde
            5/2-f). İstatistik aracımız IP adresinizi saklamaz.
          </li>
          <li>
            <strong>Aktarım:</strong> web sitesi ve istatistik sunucusu Almanya&apos;da bulunan OVH
            tarafından barındırılır; e-postalarımız Google Workspace üzerinden yönetilir. Bu nedenle
            verileriniz KVKK madde 9 kapsamında yurt dışına aktarılır. Kanunen zorunlu hâllerde
            yetkili kurumlarla paylaşılabilir. Verileriniz pazarlama amacıyla paylaşılmaz.
          </li>
          <li>
            <strong>Haklarınız (KVKK madde 11):</strong> kişisel verilerinizin işlenip işlenmediğini
            öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp
            kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri
            bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok
            edilmesini isteme, bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme,
            münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya
            çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın
            giderilmesini talep etme.
          </li>
          <li>
            <strong>Başvuru:</strong> taleplerinizi {contactLink} adresine iletebilirsiniz.
            Başvurunuzu niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz olarak
            yanıtlarız. Yanıtımızdan memnun kalmazsanız Kişisel Verileri Koruma Kurulu&apos;na
            şikâyette bulunabilirsiniz.
          </li>
        </ul>
      </div>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="Careerden Unplugged keeps your data on your computer. This page explains the little the website processes, the services the app connects to, and your rights."
      sections={sections}
      updated="18 November 2026"
      draft={false}
    />
  );
}
