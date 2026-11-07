import type { MessageKey } from '@petrik/shared/i18n'

/** The green top bar's links (label keys). */
export const upperLinks: { key: MessageKey; href: string }[] = [
  { key: 'nav.substitutions', href: 'https://filc.petrik.hu/subs' },
  { key: 'nav.calendar', href: 'https://outlook.office365.com/owa/calendar/d318bbea4a914be2abe826c0b376cc50@petrik.hu/240a9f1bbed44e0fb49ae8369939f7773872042457095598299/calendar.html' },
  { key: 'nav.timetable', href: 'https://filc.petrik.hu/' },
  { key: 'nav.documents', href: '/dokumentumtar' },
  { key: 'nav.privacy', href: '/adatvedelem' },
  { key: 'nav.kreta', href: 'http://bmszc-petrik.e-kreta.hu/' },
  { key: 'nav.mail', href: 'https://outlook.office.com/owa/' },
]

export const socialLinks = {
  facebook: 'https://www.facebook.com/BMSZCPetrik/',
  instagram: 'https://www.instagram.com/petrikinsta/',
}

export const footerColumns: { title: MessageKey; links: { key: MessageKey; href: string }[] }[] = [
  {
    title: 'nav.education',
    links: [
      { key: 'nav.eighthGraders', href: '/nyolcadikos' },
      { key: 'nav.publicEducation', href: '/kozoktatas' },
      { key: 'nav.vocational', href: '/technikusi-kepzesek' },
      { key: 'nav.evening', href: '/hirek?kategoria=Esti munkarend' },
      { key: 'nav.communityService', href: '/kozossegi-szolgalat' },
      { key: 'nav.summerInternships', href: '/nyari-gyakorlatok' },
    ],
  },
  {
    title: 'nav.exams',
    links: [
      { key: 'nav.maturaExam', href: '/erettsegi-vizsga' },
      { key: 'nav.sectoralExam', href: '/hirek?kategoria=Ágazati alapvizsga' },
      { key: 'nav.additionalQualification', href: '/hirek?kategoria=Mellék-szakképesítés' },
      { key: 'nav.vocationalExam', href: '/szakmai-vizsga' },
      { key: 'nav.languageCert', href: '/languagecert-vizsgak' },
    ],
  },
  {
    title: 'nav.other',
    links: [
      { key: 'nav.jobs', href: '/allas' },
      { key: 'nav.meals', href: '/ebed' },
      { key: 'nav.health', href: '/egeszsegugy' },
      { key: 'nav.inMemoriam', href: '/in-memoriam' },
      { key: 'nav.dormitory', href: '/kollegiumi-lehetosegek' },
      { key: 'nav.ecoSchool', href: '/orokos-okoiskola' },
      { key: 'nav.projects', href: '/projekt' },
      { key: 'nav.competitions', href: '/hirek?kategoria=Versenyeredmény' },
    ],
  },
]
