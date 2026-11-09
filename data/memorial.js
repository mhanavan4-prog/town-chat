// ---------------------------------------------------------------------------
// The memorial to the accused — a plain stone by the Town Hall, read like a
// waymarker (walk up, press F). Every name and number here is from the record;
// the myths it corrects are the ones the game's own genre has spread.
//
//   numbers   40,000–60,000 executed in Europe c. 1450–1750 (Levack 45,000;
//             Hutton 40–50,000; Behringer 50–60,000); ~80% women. The "nine
//             million" is G. C. Voigt's 1784 extrapolation, repeated by Gage
//             (1893) and Gardner (1954).
//   England   about 500 hanged (Macfarlane; Sharpe) — hanged, not burned.
//   Scotland  3,837 known accused, 84% women (Survey of Scottish Witchcraft);
//             perhaps 2,500 executed (Goodare; the Survey's own sample runs to
//             about two-thirds), strangled at the stake and then burned. The
//             First Minister's apology, 8 March 2022.
//   midwives  most accused were neither healers nor midwives (D. Harley,
//             "The Myth of the Midwife-witch", 1990).
//   names     Chelmsford 1566 pamphlet; Potts, Wonderfull Discoverie (1613);
//             A True and Exact Relation (1645), the Chelmsford depositions;
//             the Bideford trial (1682), the last hanging known for certain
//             (Alice Molland, condemned at Exeter in 1685, may not have hanged:
//             M. Stoyle, 2024); Dornoch (1727, some say 1722).
//   Ireland   few trials (the Witchcraft Act of 1586, repealed 1821). The only
//             mass trial (William Sellor was tried after it, that September): Carrickfergus assizes, 31 March 1711,
//             eight women of Islandmagee accused by Mary Dunbar; Judge Upton
//             told the jury to acquit, Judge MacCartney argued to convict;
//             a year in prison and the pillory four times (A. Sneddon and
//             S. Devlin's edition of the trial documents, w1711.org, 2022; the
//             1822 pamphlet). Names in Sneddon's spelling. That one lost an
//             eye in the pillory is local tradition, so not on the stone. The
//             plaque at the Gobbins, Islandmagee, unveiled 21 March 2023,
//             names the eight and William Sellor (Irish News).
// ---------------------------------------------------------------------------
const MEMORIAL = {
  id: 'memorial',
  name: '🕯️ In Memory of the Accused',
  text: 'Between about 1450 and 1750, some forty to sixty thousand people were put to death in Europe as witches — not the "nine million" of a 1784 guess that later writers repeated. Most were poor women, and few were healers or midwives. In England about five hundred were hanged; witches there were hanged, not burned. In Scotland perhaps two and a half thousand died, strangled at the stake and then burned.\n\n'
    + 'Remember Agnes Waterhouse, hanged at Chelmsford on 29 July 1566. Ursula Kemp, hanged in 1582. Elizabeth Southerns, called Demdike, who died in Lancaster gaol, and the ten hanged at Lancaster in August 1612: Anne Whittle, Elizabeth, James and Alizon Device, Anne Redferne, Alice Nutter, Katherine Hewitt, John and Jane Bulcock, and Isabel Robey. Elizabeth Clarke of Manningtree, and the hundred or so hanged on Matthew Hopkins\'s word in 1645–47. Temperance Lloyd, Mary Trembles and Susanna Edwards, hanged at Exeter in 1682, the last in England known for certain to have been hanged. The woman remembered as Janet Horne, put to death at Dornoch in 1727, the last in Scotland.\n\n'
    + 'In Ireland, where there were few trials, the largest, its only mass trial, was at Carrickfergus on 31 March 1711. Eight women of Islandmagee, Catherine McCalmond, Janet Liston, Elizabeth Sellor, Janet Carson, Janet Main, Janet Millar, Janet Latimer and Margaret Mitchell, were convicted on the word of a young woman, Mary Dunbar, who said they tormented her, though one of the two judges told the jury the evidence was not enough. They were imprisoned for a year and stood four times in the pillory. In 2023 a plaque to them, and to William Sellor, tried that September, was unveiled at the Gobbins in Islandmagee.\n\n'
    + 'In 2022 Scotland\'s First Minister formally apologised "to all those accused, convicted, vilified or executed" under its Witchcraft Act. The cunning folk of this town were their neighbours; this stone is theirs.',
  sources: 'B. Levack, The Witch-Hunt in Early Modern Europe (2006); Survey of Scottish Witchcraft (2003); J. Sharpe, Instruments of Darkness (1996); D. Harley (1990); the trial pamphlets of 1566, 1582, 1613 and 1645; M. Stoyle, University of Southampton (2024), on Alice Molland; A. Sneddon and S. Devlin (eds), The Islandmagee Witches documents (2022); A. Sneddon, Possessed by the Devil (2013)',
};

// ---------------------------------------------------------------------------
// After the Law — a smaller stone beside the first. In 1736 the witchcraft laws
// were repealed in Great Britain, but belief went on, and some neighbours took
// it into their own hands. Every fact below is from the record:
//
//   Osborne   ducked at Long Marston, 22 April 1751, died there; John survived;
//             Colley hanged at Gubblecut Cross, 24 August 1751 (DNB vol. 42;
//             the 1751 trial account, in Hone). "Nearly seventy": the 1751
//             account says she would have been seventy at Michaelmas.
//   Dummy     Sible Hedingham: thrown into a brook 3 August 1863, died in
//             Halstead workhouse 4 September; "about 80", name never known;
//             Emma Smith and Samuel Stammers, six months' hard labour (Bury
//             and Norwich Post, 15 March 1864).
//   Tennant   Long Compton, 15 September 1875, aged 79, stabbed with a
//             pitchfork; "the damned witches in Long Compton, sixteen of them"
//             (a witness at the inquest); not guilty by reason of insanity at
//             Warwick, December 1875 (Stratford upon Avon Herald). The man's
//             name is spelled Hayward and Haywood in the reports, so the stone
//             doesn't give it.
//   Cleary    Ballyvadlea, Co. Tipperary, 15 March 1895, aged 26; her husband
//             convicted of manslaughter (Bourke, Dictionary of Irish Biography).
// ---------------------------------------------------------------------------
const AFTER_THE_LAW = {
  id: 'after_the_law',
  name: '🕯️ After the Law',
  text: 'In 1736 Parliament repealed the laws against witchcraft in Great Britain. After that no one there could be tried as a witch, only for pretending to magic. But the belief did not end with the law, and some people took it into their own hands.\n\n'
    + 'Remember Ruth Osborne, nearly seventy, ducked as a witch in a pond at Long Marston, near Tring, on 22 April 1751, who died there. Her husband John was ducked with her and lived. Thomas Colley, who led the crowd, was hanged at Gubblecut Cross on 24 August 1751.\n\n'
    + 'Remember the man called Dummy, deaf and unable to speak, about eighty, a fortune-teller whose name was never known, thrown into a brook at Sible Hedingham on 3 August 1863 by neighbours who believed he had bewitched one of them. He died in the Halstead workhouse on 4 September. Two of them were given six months\' hard labour.\n\n'
    + 'Remember Ann Tennant, seventy-nine, stabbed with a pitchfork at Long Compton on 15 September 1875 by a man who had sworn, a neighbour said, to kill "all the damned witches in Long Compton, sixteen of them". He was found not guilty by reason of insanity.\n\n'
    + 'Remember Bridget Cleary, twenty-six, burned by her husband at Ballyvadlea, Co. Tipperary, on the night of 15 March 1895, because he believed a fairy had taken her place. He was convicted of manslaughter.\n\n'
    + 'None of them was tried as a witch. They were killed as witches, by people who knew them.',
  sources: 'Witchcraft Act 1735 (9 Geo. 2 c. 5), passed in March 1736; Dictionary of National Biography, vol. 42, "Osborne, Ruth" (1895); the 1751 trial account, in W. Hone, The Every-Day Book (1826–27), 30 July; Bury and Norwich Post (15 March 1864); Stratford upon Avon Herald (September and December 1875); A. Bourke, "Cleary, Bridget", Dictionary of Irish Biography (2009)',
};

module.exports = { MEMORIAL, AFTER_THE_LAW };
